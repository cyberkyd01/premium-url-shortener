"use client";
import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { Captcha, type CaptchaConfig } from "./captcha";
import { sendContact } from "@/app/(public)/contact/actions";

export function ContactForm({ captcha, defaults }: { captcha: CaptchaConfig | null; defaults?: { name?: string; email?: string } }) {
  const [state, action] = useActionState(sendContact, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" defaultValue={defaults?.name} required maxLength={100} /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" defaultValue={defaults?.email} required /></div>
      </div>
      <div><label className="label" htmlFor="subject">Subject</label><input id="subject" name="subject" className="input" maxLength={200} /></div>
      <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" className="input min-h-40" required maxLength={5000} /></div>
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {captcha && <Captcha config={captcha} action="contact" />}
      <SubmitButton>Send message</SubmitButton>
    </form>
  );
}
