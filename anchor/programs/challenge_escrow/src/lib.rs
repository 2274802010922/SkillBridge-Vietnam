use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
};

declare_id!("HBasPxF9R83pCFdeuvvXW5Hpt7hSMTXghLRSzeAEGpDB");
const TOKEN: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const USDC: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

#[program]
pub mod challenge_escrow {
    use super::*;
    pub fn initialize(
        ctx: Context<Initialize>,
        id: [u8; 32],
        terms: [u8; 32],
        reviewer: Pubkey,
        backup: Pubkey,
        registrar: Pubkey,
        mint: Pubkey,
        amount: u64,
        slots: u16,
        submit_deadline: i64,
        review_deadline: i64,
    ) -> Result<()> {
        require!(
            amount > 0 && slots > 0 && slots <= 100,
            EscrowError::InvalidConfig
        );
        amount
            .checked_mul(slots as u64)
            .ok_or(EscrowError::Arithmetic)?;
        let now = Clock::get()?.unix_timestamp;
        require!(
            submit_deadline > now && review_deadline > submit_deadline,
            EscrowError::InvalidConfig
        );
        require!(
            reviewer != Pubkey::default()
                && backup != Pubkey::default()
                && registrar != Pubkey::default(),
            EscrowError::InvalidConfig
        );
        require!(
            backup != reviewer && backup != ctx.accounts.funder.key(),
            EscrowError::InvalidConfig
        );
        require!(
            mint == Pubkey::default() || mint == USDC,
            EscrowError::WrongMint
        );
        let e = &mut ctx.accounts.escrow;
        e.funder = ctx.accounts.funder.key();
        e.reviewer = reviewer;
        e.backup = backup;
        e.registrar = registrar;
        e.mint = mint;
        e.id = id;
        e.terms = terms;
        e.amount = amount;
        e.slots = slots;
        e.submit_deadline = submit_deadline;
        e.review_deadline = review_deadline;
        e.bump = ctx.bumps.escrow;
        Ok(())
    }
    pub fn accept_role(ctx: Context<Manage>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        require!(e.state == 0, EscrowError::WrongState);
        let caller = ctx.accounts.actor.key();
        require!(
            caller == e.reviewer || caller == e.backup,
            EscrowError::Unauthorized
        );
        if caller == e.reviewer {
            e.accepted |= 1;
        }
        if caller == e.backup {
            e.accepted |= 2;
        }
        Ok(())
    }
    pub fn fund<'info>(ctx: Context<'info, Manage<'info>>) -> Result<()> {
        let e = &ctx.accounts.escrow;
        require!(e.state == 0 && e.funded == 0, EscrowError::WrongState);
        require_keys_eq!(
            ctx.accounts.actor.key(),
            e.funder,
            EscrowError::Unauthorized
        );
        let total = e.budget()?;
        if e.mint == Pubkey::default() {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.actor.to_account_info(),
                        to: e.to_account_info(),
                    },
                ),
                total,
            )?;
        } else {
            token_transfer(
                ctx.remaining_accounts,
                &ctx.accounts.actor.to_account_info(),
                e.funder,
                e.key(),
                e.mint,
                total,
                None,
            )?;
        }
        ctx.accounts.escrow.funded = total;
        Ok(())
    }
    pub fn publish(ctx: Context<Manage>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        require_keys_eq!(
            ctx.accounts.actor.key(),
            e.funder,
            EscrowError::Unauthorized
        );
        require!(
            e.state == 0 && e.funded == e.budget()? && e.accepted == 3,
            EscrowError::NotReady
        );
        require!(
            Clock::get()?.unix_timestamp < e.submit_deadline,
            EscrowError::Deadline
        );
        e.state = 1;
        Ok(())
    }
    pub fn register_submission(
        ctx: Context<Register>,
        submission_id: [u8; 32],
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        require!(
            e.state == 1 && Clock::get()?.unix_timestamp <= e.submit_deadline,
            EscrowError::Deadline
        );
        require_keys_eq!(
            ctx.accounts.registrar.key(),
            e.registrar,
            EscrowError::Unauthorized
        );
        let s = &mut ctx.accounts.submission;
        s.escrow = e.key();
        s.student = ctx.accounts.student.key();
        s.submission_id = submission_id;
        s.evidence_hash = evidence_hash;
        e.submissions = e
            .submissions
            .checked_add(1)
            .ok_or(EscrowError::Arithmetic)?;
        Ok(())
    }
    pub fn record_result(
        ctx: Context<Review>,
        eligible: bool,
        result_hash: [u8; 32],
    ) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        e.check_reviewer(ctx.accounts.actor.key())?;
        require!(
            e.state == 1 && Clock::get()?.unix_timestamp > e.submit_deadline,
            EscrowError::Deadline
        );
        let s = &mut ctx.accounts.submission;
        require!(s.decision == 0, EscrowError::AlreadyResolved);
        s.decision = if eligible { 1 } else { 2 };
        s.result_hash = result_hash;
        e.resolved = e.resolved.checked_add(1).ok_or(EscrowError::Arithmetic)?;
        Ok(())
    }
    pub fn allocate_award(ctx: Context<Review>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        e.check_reviewer(ctx.accounts.actor.key())?;
        require!(e.state == 1, EscrowError::WrongState);
        let s = &mut ctx.accounts.submission;
        require!(s.decision == 1, EscrowError::NotEligible);
        let allocated = checked_allocation(e.allocated, e.amount, e.budget()?)?;
        s.decision = 3;
        e.allocated = allocated;
        Ok(())
    }
    pub fn finalize_results(ctx: Context<Manage>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        e.check_reviewer(ctx.accounts.actor.key())?;
        require!(
            e.state == 1
                && Clock::get()?.unix_timestamp > e.submit_deadline
                && e.submissions == e.resolved,
            EscrowError::Unresolved
        );
        e.state = 2;
        Ok(())
    }
    pub fn claim_award<'info>(ctx: Context<'info, Claim<'info>>) -> Result<()> {
        let e = &ctx.accounts.escrow;
        let s = &ctx.accounts.submission;
        require!(e.state == 1 || e.state == 2, EscrowError::WrongState);
        require!(s.decision == 3, EscrowError::NotEligible);
        require!(!s.paid, EscrowError::AlreadyPaid);
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            s.student,
            EscrowError::WrongRecipient
        );
        pay(
            e,
            &ctx.accounts.recipient.to_account_info(),
            ctx.remaining_accounts,
            e.amount,
        )?;
        ctx.accounts.submission.paid = true;
        ctx.accounts.escrow.paid = ctx
            .accounts
            .escrow
            .paid
            .checked_add(ctx.accounts.escrow.amount)
            .ok_or(EscrowError::Arithmetic)?;
        Ok(())
    }
    pub fn refund_unused<'info>(ctx: Context<'info, Refund<'info>>) -> Result<()> {
        let e = &ctx.accounts.escrow;
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            e.funder,
            EscrowError::WrongRecipient
        );
        require!(
            e.state == 2 || (e.state == 0 && ctx.accounts.actor.key() == e.funder),
            EscrowError::Locked
        );
        let remainder = e
            .funded
            .checked_sub(e.allocated)
            .and_then(|x| x.checked_sub(e.refunded))
            .ok_or(EscrowError::Arithmetic)?;
        require!(remainder > 0, EscrowError::NoFunds);
        pay(
            e,
            &ctx.accounts.recipient.to_account_info(),
            ctx.remaining_accounts,
            remainder,
        )?;
        let e = &mut ctx.accounts.escrow;
        e.refunded = e
            .refunded
            .checked_add(remainder)
            .ok_or(EscrowError::Arithmetic)?;
        if e.state == 0 {
            e.state = 3;
        }
        Ok(())
    }
    pub fn cancel_empty(ctx: Context<Manage>) -> Result<()> {
        let e = &mut ctx.accounts.escrow;
        require_keys_eq!(
            ctx.accounts.actor.key(),
            e.funder,
            EscrowError::Unauthorized
        );
        require!(e.state == 0 && e.funded == 0, EscrowError::WrongState);
        e.state = 3;
        Ok(())
    }
}

fn checked_allocation(allocated: u64, amount: u64, budget: u64) -> Result<u64> {
    let next = allocated
        .checked_add(amount)
        .ok_or(EscrowError::Arithmetic)?;
    require!(next <= budget, EscrowError::NoFunds);
    Ok(next)
}
fn pay<'info>(
    e: &Account<'info, Escrow>,
    recipient: &AccountInfo<'info>,
    remaining: &[AccountInfo<'info>],
    amount: u64,
) -> Result<()> {
    if e.mint == Pubkey::default() {
        let floor = Rent::get()?.minimum_balance(e.to_account_info().data_len());
        require!(
            e.to_account_info().lamports().saturating_sub(floor) >= amount,
            EscrowError::NoFunds
        );
        e.sub_lamports(amount)?;
        recipient.add_lamports(amount)?;
    } else {
        let bump = [e.bump];
        let seeds: &[&[u8]] = &[b"escrow", e.funder.as_ref(), e.id.as_ref(), &bump];
        token_transfer(
            remaining,
            &e.to_account_info(),
            e.key(),
            recipient.key(),
            e.mint,
            amount,
            Some(seeds),
        )?;
    }
    Ok(())
}
// Only classic SPL Token. Both token accounts are validated before CPI. No arbitrary CPI target.
fn token_transfer<'info>(
    accounts: &[AccountInfo<'info>],
    authority: &AccountInfo<'info>,
    source_owner: Pubkey,
    dest_owner: Pubkey,
    mint: Pubkey,
    amount: u64,
    seeds: Option<&[&[u8]]>,
) -> Result<()> {
    require!(accounts.len() == 3, EscrowError::WrongTokenAccount);
    let src = &accounts[0];
    let dst = &accounts[1];
    let program = &accounts[2];
    require_keys_eq!(program.key(), TOKEN, EscrowError::WrongTokenAccount);
    for (a, owner) in [(src, source_owner), (dst, dest_owner)] {
        require_keys_eq!(*a.owner, TOKEN, EscrowError::WrongTokenAccount);
        let d = a.try_borrow_data()?;
        require!(
            d.len() == 165 && d[108] == 1,
            EscrowError::WrongTokenAccount
        );
        require!(
            d[..32] == mint.to_bytes() && d[32..64] == owner.to_bytes(),
            EscrowError::WrongTokenAccount
        );
    }
    require_keys_neq!(src.key(), dst.key(), EscrowError::WrongTokenAccount);
    let mut data = vec![3u8];
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: TOKEN,
        accounts: vec![
            AccountMeta::new(src.key(), false),
            AccountMeta::new(dst.key(), false),
            AccountMeta::new_readonly(authority.key(), true),
        ],
        data,
    };
    let infos = [src.clone(), dst.clone(), authority.clone(), program.clone()];
    if let Some(s) = seeds {
        invoke_signed(&ix, &infos, &[s])?;
    } else {
        invoke(&ix, &infos)?;
    }
    Ok(())
}

#[derive(Accounts)]
#[instruction(id:[u8;32])]
pub struct Initialize<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(init,payer=funder,space=8+384,seeds=[b"escrow",funder.key().as_ref(),id.as_ref()],bump)]
    pub escrow: Account<'info, Escrow>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Manage<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut,seeds=[b"escrow",escrow.funder.as_ref(),escrow.id.as_ref()],bump=escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Register<'info> {
    #[account(mut)]
    pub student: Signer<'info>,
    pub registrar: Signer<'info>,
    #[account(mut,seeds=[b"escrow",escrow.funder.as_ref(),escrow.id.as_ref()],bump=escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(init,payer=student,space=8+176,seeds=[b"submission",escrow.key().as_ref(),student.key().as_ref()],bump)]
    pub submission: Account<'info, Submission>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Review<'info> {
    pub actor: Signer<'info>,
    #[account(mut,seeds=[b"escrow",escrow.funder.as_ref(),escrow.id.as_ref()],bump=escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut,has_one=escrow,seeds=[b"submission",escrow.key().as_ref(),submission.student.as_ref()],bump)]
    pub submission: Account<'info, Submission>,
}
#[derive(Accounts)]
pub struct Claim<'info> {
    pub actor: Signer<'info>,
    #[account(mut,seeds=[b"escrow",escrow.funder.as_ref(),escrow.id.as_ref()],bump=escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut,has_one=escrow,seeds=[b"submission",escrow.key().as_ref(),submission.student.as_ref()],bump)]
    pub submission: Account<'info, Submission>,
    /// CHECK: fixed to submission.student before transferring, may be any wallet.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}
#[derive(Accounts)]
pub struct Refund<'info> {
    pub actor: Signer<'info>,
    #[account(mut,seeds=[b"escrow",escrow.funder.as_ref(),escrow.id.as_ref()],bump=escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    /// CHECK: fixed to escrow.funder before transferring.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}
#[account]
pub struct Escrow {
    pub funder: Pubkey,
    pub reviewer: Pubkey,
    pub backup: Pubkey,
    pub registrar: Pubkey,
    pub mint: Pubkey,
    pub id: [u8; 32],
    pub terms: [u8; 32],
    pub amount: u64,
    pub slots: u16,
    pub submit_deadline: i64,
    pub review_deadline: i64,
    pub state: u8,
    pub accepted: u8,
    pub funded: u64,
    pub allocated: u64,
    pub paid: u64,
    pub refunded: u64,
    pub submissions: u32,
    pub resolved: u32,
    pub bump: u8,
}
impl Escrow {
    fn budget(&self) -> Result<u64> {
        self.amount
            .checked_mul(self.slots as u64)
            .ok_or(EscrowError::Arithmetic.into())
    }
    fn check_reviewer(&self, caller: Pubkey) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            (now <= self.review_deadline && caller == self.reviewer)
                || (now > self.review_deadline && caller == self.backup),
            EscrowError::Unauthorized
        );
        Ok(())
    }
}
#[account]
pub struct Submission {
    pub escrow: Pubkey,
    pub student: Pubkey,
    pub submission_id: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub result_hash: [u8; 32],
    pub decision: u8,
    pub paid: bool,
}

#[error_code]
pub enum EscrowError {
    #[msg("Invalid configuration")]
    InvalidConfig,
    #[msg("Wrong asset")]
    WrongMint,
    #[msg("Unauthorized wallet")]
    Unauthorized,
    #[msg("Operation is not allowed in this state")]
    WrongState,
    #[msg("Funding and reviewer consent required")]
    NotReady,
    #[msg("Deadline does not allow this action")]
    Deadline,
    #[msg("Result already recorded")]
    AlreadyResolved,
    #[msg("Not selected for this reward")]
    NotEligible,
    #[msg("Reward already paid")]
    AlreadyPaid,
    #[msg("Wrong recipient")]
    WrongRecipient,
    #[msg("Reviews are unresolved")]
    Unresolved,
    #[msg("Reward fund is locked")]
    Locked,
    #[msg("Insufficient unallocated reward budget")]
    NoFunds,
    #[msg("Invalid token account")]
    WrongTokenAccount,
    #[msg("Arithmetic overflow")]
    Arithmetic,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn allocation_never_exceeds_budget() {
        assert_eq!(checked_allocation(20, 10, 30).unwrap(), 30);
        assert!(checked_allocation(30, 10, 30).is_err());
        assert!(checked_allocation(u64::MAX, 1, u64::MAX).is_err());
    }
}
