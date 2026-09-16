"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/i18n";
import { walletOnboardingCopy } from "../../i18n/wallet-onboarding";
import { WALLET_DOWNLOADS, phantomBrowseUrl, suggestedWalletDevice, walletHandoffUrl } from "../../../shared/validation/wallet-onboarding";
import styles from "./wallet-onboarding.module.css";

export function WalletOnboarding({ returnTo, onCheck, onSkip }: { returnTo: string; onCheck: () => void; onSkip: () => void }) {
  const { locale } = useLanguage();
  const copy = walletOnboardingCopy[locale];
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [wallet, setWallet] = useState<keyof typeof WALLET_DOWNLOADS>("phantom");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDevice(suggestedWalletDevice(navigator.userAgent, navigator.maxTouchPoints));
      setOrigin(window.location.origin);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const info = WALLET_DOWNLOADS[wallet];
  const handoff = origin ? walletHandoffUrl(origin, returnTo, locale) : "";
  const browse = origin ? phantomBrowseUrl(origin, returnTo, locale) : null;
  function go(next: number) {
    setStep(next); setCopied(null);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function copyAddress() {
    try { await navigator.clipboard.writeText(handoff); setCopied("ok"); }
    catch { setCopied("failed"); }
  }
  return <section className={styles.guide} aria-label={copy.guide}>
    <div className={styles.devices} role="group" aria-label={copy.device}>
      <button type="button" className={styles.choice} aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>{copy.desktop}</button>
      <button type="button" className={styles.choice} aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>{copy.mobile}</button>
    </div>
    <ol className={styles.steps}>
      {copy.steps.map((label, index) => <li key={index}><button type="button" className={styles.step} aria-current={step === index ? "step" : undefined} onClick={() => go(index)}><span aria-hidden="true">{index + 1}</span>{label}</button></li>)}
    </ol>
    <div className={styles.panel}>
      <h3 ref={heading} tabIndex={-1}>{step === 0 ? copy.choose : step === 1 ? copy.create : copy.connect}</h3>
      {step === 0 && <>
        <p>{copy.chooseHint}</p>
        <fieldset><legend>{copy.walletChoice}</legend><div className={styles.walletOptions}>
          {(Object.keys(WALLET_DOWNLOADS) as Array<keyof typeof WALLET_DOWNLOADS>).map(id => <label className={styles.walletOption} key={id} htmlFor={`install-${id}`} aria-label={WALLET_DOWNLOADS[id].name}>
            <input id={`install-${id}`} type="radio" name="onboarding-wallet" value={id} checked={wallet === id} onChange={() => setWallet(id)} />
            <span><strong>{WALLET_DOWNLOADS[id].name}</strong><small>{id === "phantom" ? copy.recommended : copy.alternative}</small></span>
          </label>)}
        </div></fieldset>
        <p>{device === "desktop" ? copy.desktopDownload : copy.mobileDownload}</p>
        <a className={`${styles.action} ${styles.primary}`} href={info.url} target="_blank" rel="noopener noreferrer">{device === "desktop" ? copy.downloadDesktop : copy.downloadMobile} · {info.name}</a>
        <p className={styles.note}>{info.domain} — {copy.downloadNote}</p>
        <button className={styles.link} type="button" onClick={() => go(1)}>{copy.nextCreate} →</button>
      </>}
      {step === 1 && <>
        <p>{copy.createHint}</p>
        <p>{wallet === "phantom" ? copy.phantomCreate : copy.otherCreate}</p>
        <p className={styles.safety}>{copy.safety}</p>
        <div className={styles.actions}><button className={styles.action} type="button" onClick={() => go(0)}>{copy.back}</button><button className={`${styles.action} ${styles.primary}`} type="button" onClick={() => go(2)}>{copy.nextConnect}</button></div>
      </>}
      {step === 2 && <>
        <p>{device === "desktop" ? copy.desktopConnect : copy.mobileConnect}</p>
        {device === "mobile" && <>
          {wallet === "phantom" && browse && <a className={`${styles.action} ${styles.primary}`} href={browse} referrerPolicy="no-referrer">{copy.openPhantom}</a>}
          {!browse && <p className={styles.note}>{copy.localOnly}</p>}
          <p className={styles.note}>{copy.browserUnavailable}</p>
          <button className={styles.action} type="button" disabled={!handoff} onClick={() => void copyAddress()}>{copy.copy}</button>
          <label className={styles.address}>{copy.address}<input readOnly value={handoff} onFocus={event => event.target.select()} /></label>
          <p role="status" className={styles.note}>{copied === "ok" ? copy.copied : copied === "failed" ? copy.copyFailed : ""}</p>
        </>}
        <button className={`${styles.action} ${device === "desktop" ? styles.primary : ""}`} type="button" onClick={onCheck}>{copy.check}</button>
        <div className={styles.actions}><button className={styles.link} type="button" onClick={() => go(1)}>{copy.back}</button><button className={styles.link} type="button" onClick={() => window.location.reload()}>{copy.reload}</button></div>
        <p className={styles.note}>{copy.noFunds}</p>
      </>}
    </div>
    <button className={styles.link} type="button" onClick={onSkip}>{copy.skip}</button>
  </section>;
}
