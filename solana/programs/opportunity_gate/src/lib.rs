use anchor_lang::prelude::*;

declare_id!("AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE");

#[program]
pub mod opportunity_gate {
    use super::*;

    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        policy_id: [u8; 32],
        trusted_issuer: Pubkey,
        schema: Pubkey,
        verifier: Pubkey,
        minimum_score: u16,
    ) -> Result<()> {
        validate_score(minimum_score)?;
        require_keys_neq!(trusted_issuer, Pubkey::default(), GateError::InvalidKey);
        require_keys_neq!(schema, Pubkey::default(), GateError::InvalidKey);
        require_keys_neq!(verifier, Pubkey::default(), GateError::InvalidKey);

        let policy = &mut ctx.accounts.policy;
        policy.authority = ctx.accounts.authority.key();
        policy.policy_id = policy_id;
        policy.trusted_issuer = trusted_issuer;
        policy.schema = schema;
        policy.verifier = verifier;
        policy.minimum_score = minimum_score;
        policy.active = true;
        policy.bump = ctx.bumps.policy;

        emit!(PolicyInitialized {
            policy: policy.key(),
            authority: policy.authority,
            trusted_issuer,
            schema,
            verifier,
            minimum_score,
        });
        Ok(())
    }

    pub fn update_policy(
        ctx: Context<ManagePolicy>,
        trusted_issuer: Pubkey,
        schema: Pubkey,
        verifier: Pubkey,
        minimum_score: u16,
        active: bool,
    ) -> Result<()> {
        validate_score(minimum_score)?;
        require_keys_neq!(trusted_issuer, Pubkey::default(), GateError::InvalidKey);
        require_keys_neq!(schema, Pubkey::default(), GateError::InvalidKey);
        require_keys_neq!(verifier, Pubkey::default(), GateError::InvalidKey);

        let policy = &mut ctx.accounts.policy;
        policy.trusted_issuer = trusted_issuer;
        policy.schema = schema;
        policy.verifier = verifier;
        policy.minimum_score = minimum_score;
        policy.active = active;

        emit!(PolicyUpdated {
            policy: policy.key(),
            trusted_issuer,
            schema,
            verifier,
            minimum_score,
            active,
        });
        Ok(())
    }

    pub fn record_access(
        ctx: Context<RecordAccess>,
        attestation: Pubkey,
        subject: Pubkey,
        score: u16,
        verification_digest: [u8; 32],
    ) -> Result<()> {
        let policy = &ctx.accounts.policy;
        validate_access(policy.active, policy.minimum_score, score)?;
        require_keys_neq!(attestation, Pubkey::default(), GateError::InvalidKey);
        require_keys_neq!(subject, Pubkey::default(), GateError::InvalidKey);

        let receipt = &mut ctx.accounts.access_receipt;
        receipt.policy = policy.key();
        receipt.subject = subject;
        receipt.attestation = attestation;
        receipt.verifier = ctx.accounts.verifier.key();
        receipt.score = score;
        receipt.verification_digest = verification_digest;
        receipt.verified_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.access_receipt;

        emit!(AccessRecorded {
            receipt: receipt.key(),
            policy: receipt.policy,
            subject,
            attestation,
            score,
            verification_digest,
        });
        Ok(())
    }

    pub fn close_policy(_ctx: Context<ClosePolicy>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(policy_id: [u8; 32])]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Policy::INIT_SPACE,
        seeds = [b"policy", authority.key().as_ref(), policy_id.as_ref()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManagePolicy<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ GateError::Unauthorized,
        seeds = [b"policy", authority.key().as_ref(), policy.policy_id.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
#[instruction(attestation: Pubkey, subject: Pubkey)]
pub struct RecordAccess<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub verifier: Signer<'info>,
    #[account(
        constraint = policy.verifier == verifier.key() @ GateError::UnauthorizedVerifier
    )]
    pub policy: Account<'info, Policy>,
    #[account(
        init,
        payer = payer,
        space = 8 + AccessReceipt::INIT_SPACE,
        seeds = [b"access", policy.key().as_ref(), subject.as_ref(), attestation.as_ref()],
        bump
    )]
    pub access_receipt: Account<'info, AccessReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = authority,
        has_one = authority @ GateError::Unauthorized,
        seeds = [b"policy", authority.key().as_ref(), policy.policy_id.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub authority: Pubkey,
    pub policy_id: [u8; 32],
    pub trusted_issuer: Pubkey,
    pub schema: Pubkey,
    pub verifier: Pubkey,
    pub minimum_score: u16,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AccessReceipt {
    pub policy: Pubkey,
    pub subject: Pubkey,
    pub attestation: Pubkey,
    pub verifier: Pubkey,
    pub score: u16,
    pub verification_digest: [u8; 32],
    pub verified_at: i64,
    pub bump: u8,
}

#[event]
pub struct PolicyInitialized {
    pub policy: Pubkey,
    pub authority: Pubkey,
    pub trusted_issuer: Pubkey,
    pub schema: Pubkey,
    pub verifier: Pubkey,
    pub minimum_score: u16,
}

#[event]
pub struct PolicyUpdated {
    pub policy: Pubkey,
    pub trusted_issuer: Pubkey,
    pub schema: Pubkey,
    pub verifier: Pubkey,
    pub minimum_score: u16,
    pub active: bool,
}

#[event]
pub struct AccessRecorded {
    pub receipt: Pubkey,
    pub policy: Pubkey,
    pub subject: Pubkey,
    pub attestation: Pubkey,
    pub score: u16,
    pub verification_digest: [u8; 32],
}

#[error_code]
pub enum GateError {
    #[msg("The signer is not authorized to manage this policy")]
    Unauthorized,
    #[msg("The verifier is not authorized by this policy")]
    UnauthorizedVerifier,
    #[msg("The policy is inactive")]
    InactivePolicy,
    #[msg("The credential score does not satisfy the policy")]
    ScoreTooLow,
    #[msg("Score must be between 0 and 100")]
    InvalidScore,
    #[msg("A required public key cannot be the default address")]
    InvalidKey,
}

fn validate_score(score: u16) -> Result<()> {
    require!(score <= 100, GateError::InvalidScore);
    Ok(())
}

fn validate_access(active: bool, minimum_score: u16, score: u16) -> Result<()> {
    require!(active, GateError::InactivePolicy);
    validate_score(score)?;
    require!(score >= minimum_score, GateError::ScoreTooLow);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_qualifying_active_credential() {
        assert!(validate_access(true, 80, 80).is_ok());
        assert!(validate_access(true, 80, 97).is_ok());
    }

    #[test]
    fn rejects_an_inactive_policy() {
        assert!(validate_access(false, 0, 100).is_err());
    }

    #[test]
    fn rejects_a_below_threshold_score() {
        assert!(validate_access(true, 80, 79).is_err());
    }

    #[test]
    fn rejects_scores_outside_the_contract() {
        assert!(validate_score(101).is_err());
        assert!(validate_access(true, 0, 101).is_err());
    }
}
