import { Link } from "react-router";
import { NavBar } from "../components/NavBar";

export function meta() {
  return [
    { title: "Adult Content Guidelines • Webcomic Studio" },
    { name: "description", content: "Guidelines for publishing mature or adult-themed webcomic content responsibly." }
  ];
}

export default function AdultContentGuidelinesPage() {
  const lastUpdated = 'November 20th, 2025';
  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1>Adult Content Guidelines</h1>
        <p>Last updated: {lastUpdated}</p>
        
        <p>Webcomic Studio does not allow comics with harmful or pornographic material, but this doesn't mean that ALL adult content is banned. Admittedly, the lines between "pornographic" and "mature themes" can be quite blurry. The following are guidelines to help you determine if your comic falls within Webcomic Studio's Terms of Service.</p>
        
        <p>Without further ado, let's talk about SEX.</p>
        
        <h2>This is not a moral judgement</h2>
        <p>For the record, we have no issue with ethical pornography featuring consenting adults. The reason it's not allowed on the platform is purely due to the fact that hosting such content is a legal and financial nightmare. Webcomic Studio's underlying hosting providers AND payment processors do not allow their services to be used for pornographic material. That's all!</p>
        
        <h2>What sexual material is NOT allowed</h2>
        <p>The following sexual material is banned on Webcomic Studio:</p>
        <ul>
          <li>Explicit depictions of genitalia in a sexual context</li>
          <li>Graphic sexual acts or sexual positions shown clearly and in detail</li>
          <li>Content created for the purpose of sexual arousal or fetish fulfillment</li>
          <li>Masturbation, oral/penetrative sex shown explicitly</li>
          <li>Sexualized focus on body parts (e.g., lingering on genitals, breasts, buttocks meant for arousal)</li>
          <li>Any sexual content involving minors (even implied)</li>
          <li>Non-consensual sexual acts, assault, exploitation</li>
        </ul>
        
        <h2>What sexual material IS allowed</h2>
        <ul>
          <li>Artistic, cultural, educational, or non-sexual nudity</li>
          <li>Romantic or intimate scenes between consenting adults</li>
          <li>Non-graphic depictions of sexual activity (silhouettes, fade-to-black scenes, off-screen context)</li>
          <li>Non-erotic depictions of bodies (e.g., characters undressing, bathing, etc.)</li>
          <li>Mild erotic tension or romantic suggestiveness, as long as the focus is narrative rather than for sexual gratification</li>
        </ul>
        
        <h2>Examples of what is allowed</h2>
        <ul>
          <li>Two adult characters kiss, then the scene cuts to them waking up together</li>
          <li>A panel shows an implied sex scene where details are obscured by shadows, blankets, silhouettes</li>
          <li>An intimate moment where one partner removes clothing but nothing sexual is shown explicitly</li>
          <li>Mature storylines involving relationships, heartbreak, romance, or adult themes where sex is a natural part of the narrative</li>
          <li>Characters seen nude in a non-sexual way (changing clothes, medical context, bathing, etc.)</li>
        </ul>
        
        <h2>The big takeaway</h2>
        <p>Sexual themes are fine when they serve the plot, character development, or emotional context, but intent and presentation are KEY.</p>
        
        <h2>If Your Comic Is Reported</h2>
        <p>Webcomic Studio relies on strict compliance with our payment processor and hosting provider policies. Violating those rules doesn't just affect individual accounts—it can put the entire platform at risk. Please help keep Webcomic Studio safe and available for everyone by following these guidelines.</p>
        
        <p>If your comic is reported for containing prohibited content, don't panic. A report does not mean you're automatically in trouble. The flagged material will be reviewed to determine whether it violates our guidelines.</p>
        
        <p><strong>If no violation is found:</strong> Nothing happens. Your comic stays up, and you're all set.</p>
        
        <p><strong>If a violation is confirmed:</strong> You will receive one warning with details about the issue.</p>
        
        <p><strong>If a second violation occurs:</strong> Your account will be permanently banned, and your comic will be removed.</p>
        
        <p>This process is meant to be fair and transparent, while ensuring that the platform remains safe, compliant, and accessible to all creators. If you're ever unsure whether something is allowed, feel free to reach out for clarification.</p>
        
        <p>If you believe content violates these guidelines, please <Link to="/report">report an issue</Link>.</p>
      </main>
      <footer className="py-10 border-t border-(--border) bg-(--bg)">
        <div className="mx-auto max-w-6xl px-4 w-full text-center text-sm text-(--muted) flex flex-col gap-2">
          <div>© {new Date().getFullYear()} Webcomic Studio · Build, publish & grow your comic.</div>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/adult-content-guidelines" className="hover:underline">Adult Content Guidelines</Link>
            <Link to="/report" className="hover:underline">Report an issue</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
