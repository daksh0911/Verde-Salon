import { Link } from 'react-router-dom';
import { LEGAL as L, CONSENT_KEY } from '../legal';

const Page = ({ title, children }) => <div className="wrap page legal" style={{ maxWidth: 780 }}>
  <p className="eyebrow">Legal</p><h1 style={{ fontSize: 'clamp(40px,6vw,64px)' }}>{title}</h1>
  <p className="hint" style={{ margin: '12px 0 28px' }}>Last updated {L.updated}</p>{children}</div>;
const S = ({ h, children }) => <section style={{ marginBottom: 26 }}><h2 style={{ fontSize: 26, marginBottom: 8 }}>{h}</h2>{children}</section>;

export function Privacy() {
  return <Page title="Privacy Policy">
    <p>{L.business} ("we", "us") runs this website and booking system. This policy explains what personal data we collect, why, who sees it, and the choices you have. It is written to meet India's Digital Personal Data Protection Act, 2023, and we apply the same care to visitors from elsewhere.</p>
    <S h="Who is responsible"><p>{L.business}, {L.address}. For anything about your data, write to <a href={`mailto:${L.email}`}>{L.email}</a>.</p></S>
    <S h="What we collect">
      <ul>
        <li><b>Account details:</b> name, email, phone number (optional), birthday (optional, used for a yearly treat), and a password that we store only as a one-way hash.</li>
        <li><b>Booking details:</b> services, stylist, date and time, deposits, offers used, visit status (completed, cancelled, no-show), loyalty points and referrals.</li>
        <li><b>Consultation card (optional):</b> hair type, allergies, goals, notes and an inspiration photo link. Allergies are health-related, so we ask you to share only what your stylist needs for your safety.</li>
        <li><b>Stylist notes:</b> colour formulas and service notes recorded after a visit.</li>
        <li><b>Patch tests and gallery photos:</b> we note the date of your allergy patch test, and we show before and after photos on the site only with your written consent.</li>
        <li><b>Messages and reviews:</b> what you send through the contact form or write in a review.</li>
        <li><b>Technical data:</b> your IP address and basic request details are processed to keep the site secure and to limit abuse. We do not run analytics or advertising trackers.</li>
      </ul>
    </S>
    <S h="Why we use it">
      <ul>
        <li>To create your account, run your appointments, take deposits and send you what you need for a visit (performing our service to you).</li>
        <li>To keep you safe, for example by flagging allergies to your stylist.</li>
        <li>To run loyalty points, rewards, referrals and your birthday treat.</li>
        <li>To reply to your messages and to handle reviews, including low ratings that go to the owner first.</li>
        <li>To protect the site from fraud and abuse, and to meet legal and tax obligations.</li>
      </ul>
      <p style={{ marginTop: 8 }}>We do not sell your data and we do not use it for advertising.</p>
    </S>
    <S h="Who can see it"><p>Only the people who need it: your assigned stylist sees your booking and consultation card; the front desk sees bookings and arrival status; the owner sees everything, including revenue. Front-desk staff do not see revenue figures.</p></S>
    <S h="Other services involved">
      <ul>
        <li><b>Google Fonts</b> serves the site's typefaces, so your browser contacts Google's servers and shares your IP address with them when pages load.</li>
        <li><b>WhatsApp</b> opens only if you click a WhatsApp link; from then on WhatsApp's own policy applies.</li>
        <li><b>Hosting provider</b> stores our database and processes requests on our behalf.</li>
      </ul>
      <p style={{ marginTop: 8 }}>Your data may be processed on servers outside India by these providers. We ask them to protect it to a standard comparable to this policy.</p>
    </S>
    <S h="How long we keep it"><p>Account and booking records: {L.retention.accounts}. Contact messages: {L.retention.messages}. Consultation card: {L.retention.consultation}. Accounting records may be kept longer where the law requires.</p></S>
    <S h="How we protect it"><p>Passwords are hashed, sign-in uses a secure cookie that scripts cannot read, connections use HTTPS, forms and sign-in attempts are rate limited, and staff access is limited by role. No system is perfectly secure; if a breach affects you, we will tell you and the Data Protection Board of India as the law requires.</p></S>
    <S h="Your rights">
      <p>You can ask us to access, correct, update or erase your personal data, to withdraw consent you have given, or to raise a complaint. You can edit your name, phone, birthday and photo yourself after signing in. For anything else, or to delete your account, email <a href={`mailto:${L.email}`}>{L.email}</a> from the address on your account and we will respond within 30 days. If we cannot resolve your concern you may complain to the Data Protection Board of India.</p>
    </S>
    <S h="Children"><p>This service is for adults. We do not knowingly create accounts for anyone under 18. If you believe a child has registered, contact us and we will remove the account. A parent or guardian may book on a child's behalf using their own account.</p></S>
    <S h="Cookies"><p>See our <Link to="/cookies">Cookie Policy</Link>. In short: one essential sign-in cookie and one small preference stored on your device. No tracking.</p></S>
    <S h="Changes"><p>If we change this policy in a meaningful way we will update the date above and, for registered clients, tell you when you next sign in.</p></S>
  </Page>;
}

export function Cookies() {
  const reset = () => { try { localStorage.removeItem(CONSENT_KEY); } catch { /* storage unavailable */ } location.reload(); };
  return <Page title="Cookie Policy">
    <p>Cookies are small files a website stores on your device. We keep ours to the minimum needed to run the site. We do not use analytics, advertising or tracking cookies.</p>
    <S h="What we store">
      <div style={{ overflowX: 'auto' }}><table className="legal-table"><thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Lasts</th></tr></thead><tbody>
        <tr><td><code>verde_session</code></td><td>Cookie (essential)</td><td>Keeps you signed in. Marked HttpOnly (scripts cannot read it), SameSite=Lax and Secure on HTTPS.</td><td>7 days, or until you sign out</td></tr>
        <tr><td><code>{CONSENT_KEY}</code></td><td>Local storage (preference)</td><td>Remembers that you have seen this notice.</td><td>Until you clear it</td></tr>
      </tbody></table></div>
    </S>
    <S h="Essential items need no consent"><p>The sign-in cookie is strictly necessary to provide the account features you ask for, so it is set without a choice, the same as under the usual cookie rules in India and the EU. The notice preference is tiny and only stays on your device.</p></S>
    <S h="Third-party requests"><p>Loading fonts from Google means Google receives your IP address, even though it does not set cookies for us. Details are in the <Link to="/privacy">Privacy Policy</Link>.</p></S>
    <S h="Your choices"><p>You can delete cookies and site data in your browser settings at any time; you will be signed out and you will see the cookie notice again. Blocking the sign-in cookie means you cannot log in. <button className="chip" onClick={reset}>Show the cookie notice again</button></p></S>
    <S h="Questions"><p>Email <a href={`mailto:${L.email}`}>{L.email}</a>.</p></S>
  </Page>;
}
