import React, { useState } from "react";
import type { Route } from "./+types/report";
import { NavBar } from "../components/NavBar";
import { prisma } from "../utils/db.server";
import { useLoaderData, redirect, Form } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Webcomic Studio • Report an Issue" }
  ];
}

export async function action({ request }: Route.ActionArgs) {
  console.log("=== REPORT ACTION CALLED ===");
  const formData = await request.formData();
  
  // Honeypot check - if this field is filled, it's likely a bot
  const honeypot = formData.get("website") as string;
  if (honeypot) {
    console.log("Honeypot triggered - potential bot");
    // Pretend it worked but don't send email
    return redirect("/report?success=true");
  }

  const type = formData.get("type") as string;
  const subject = formData.get("subject") as string;
  const email = formData.get("email") as string;
  const chapter = formData.get("chapter") as string;
  const page = formData.get("page") as string;
  const description = formData.get("description") as string;
  const comicId = formData.get("comicId") as string;

  console.log("Form data:", { type, subject, email, chapter, page, description, comicId });

  // Basic rate limiting check - prevent same email from submitting too frequently
  // In production, you'd use Redis or a database for this
  // For now, we'll just add a timestamp check in the session or skip it

  // Get comic details for the email
  let comicTitle = "Unknown Comic";
  let chapterTitle = "";
  if (comicId) {
    const comic = await prisma.comic.findUnique({
      where: { id: comicId },
      select: { title: true },
    });
    if (comic) comicTitle = comic.title;
  }
  if (chapter) {
    const chapterData = await prisma.chapter.findUnique({
      where: { id: chapter },
      select: { title: true },
    });
    if (chapterData) chapterTitle = chapterData.title;
  }

  // Send email via Mailgun
  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
  const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

  console.log("Mailgun config:", { 
    hasApiKey: !!MAILGUN_API_KEY, 
    domain: MAILGUN_DOMAIN, 
    adminEmail: ADMIN_EMAIL 
  });

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !ADMIN_EMAIL) {
    console.error("Missing Mailgun configuration");
    return { error: "Email service not configured" };
  }

  // Get comic domain/slug for building URL
  let reportedPageUrl = "";
  if (comicId) {
    const comicData = await prisma.comic.findUnique({
      where: { id: comicId },
      select: { slug: true, domain: true },
    });
    if (comicData) {
      const isDev = process.env.NODE_ENV === 'development';
      let baseUrl;
      
      if (comicData.domain) {
        baseUrl = isDev 
          ? `http://${comicData.domain}:5173` 
          : `https://${comicData.domain}`;
      } else {
        baseUrl = isDev
          ? `http://${comicData.slug}.localhost:5173`
          : `https://${comicData.slug}.webcomic.studio`;
      }
      
      if (chapter && page) {
        reportedPageUrl = `${baseUrl}/${chapter}/${page}`;
      }
    }
  }

  const emailBodyText = `
New Issue Report

Comic: ${comicTitle}
Type: ${type}
Subject: ${subject}
Reporter Email: ${email}
${chapterTitle ? `Chapter: ${chapterTitle}` : ''}
${page ? `Page: ${page}` : ''}

Description:
${description}

${reportedPageUrl ? `Reported Page: ${reportedPageUrl}` : ''}
  `.trim();

  const emailBodyHtml = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb;">New Issue Report</h2>
  
  <p><strong>Comic:</strong> ${comicTitle}</p>
  <p><strong>Type:</strong> ${type}</p>
  <p><strong>Subject:</strong> ${subject}</p>
  <p><strong>Reporter Email:</strong> ${email}</p>
  ${chapterTitle ? `<p><strong>Chapter:</strong> ${chapterTitle}</p>` : ''}
  ${page ? `<p><strong>Page:</strong> ${page}</p>` : ''}
  
  <p><strong>Description:</strong></p>
  <p style="white-space: pre-wrap;">${description}</p>
  
  ${reportedPageUrl ? `
  <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
  <p><strong>Reported Page:</strong><br>
  <a href="${reportedPageUrl}" style="color: #2563eb;">${reportedPageUrl}</a></p>
  ` : ''}
</body>
</html>
  `.trim();

  try {
    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          from: `Webcomic Studio Reports <noreply@${MAILGUN_DOMAIN}>`,
          to: ADMIN_EMAIL,
          subject: `Issue Report: ${subject} - ${comicTitle}`,
          text: emailBodyText,
          html: emailBodyHtml,
          "h:Reply-To": email,
        }),
      }
    );

    if (!response.ok) {
      console.error("Mailgun error:", await response.text());
      return { error: "Failed to send report" };
    }

    return redirect("/report?success=true");
  } catch (error) {
    console.error("Error sending email:", error);
    return { error: "Failed to send report" };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const comicId = url.searchParams.get("comicId");
  const chapterId = url.searchParams.get("chapterId");
  const pageParams = url.searchParams.getAll("page");
  
  if (!comicId) {
    return { comic: null, chapters: [], defaultChapterId: null, defaultPageNumber: null };
  }

  const comic = await prisma.comic.findUnique({
    where: { id: comicId },
    select: { 
      id: true, 
      title: true,
      doubleSpread: true,
      chapters: {
        select: {
          id: true,
          number: true,
          title: true,
          publishedDate: true,
          pages: {
            select: {
              id: true,
              number: true,
            },
            orderBy: { number: 'asc' },
          },
        },
        orderBy: { number: 'asc' },
      },
    },
  });

  if (!comic) {
    return { comic: null, chapters: [], defaultChapterId: null, defaultPageNumber: null };
  }

  // Filter published chapters
  const publishedChapters = comic.chapters.filter(
    ch => ch.publishedDate && new Date(ch.publishedDate) <= new Date()
  );

  // Use only the first page number from URL params
  const defaultPageNumber = pageParams.length > 0 ? parseInt(pageParams[0], 10) : null;
  const validPageNumber = defaultPageNumber && !isNaN(defaultPageNumber) ? defaultPageNumber : null;

  // If we have a page number and it's a double spread, normalize to spread start
  let normalizedPageNumber = validPageNumber;
  if (validPageNumber && comic.doubleSpread) {
    normalizedPageNumber = validPageNumber - ((validPageNumber - 1) % 2);
  }

  return { 
    comic: { id: comic.id, title: comic.title, doubleSpread: comic.doubleSpread }, 
    chapters: publishedChapters,
    defaultChapterId: chapterId,
    defaultPageNumber: normalizedPageNumber,
  };
}

export default function ReportPage() {
  const { comic, chapters, defaultChapterId, defaultPageNumber } = useLoaderData<typeof loader>();
  const [selectedChapterId, setSelectedChapterId] = useState(defaultChapterId || chapters[0]?.id || "");
  const [selectedPageNumber, setSelectedPageNumber] = useState(defaultPageNumber?.toString() || "");

  const selectedChapter = chapters.find(ch => ch.id === selectedChapterId);

  // Check for success message
  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const success = url?.searchParams.get('success') === 'true';

  return (
    <>
      <NavBar />
      <main className="flex flex-col items-center justify-center min-h-[60vh] py-8">
        <h1 className="text-2xl font-bold mb-4">Report an Issue</h1>
        
        {success ? (
          <div className="w-full max-w-md bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            Thank you! Your report has been submitted successfully.
          </div>
        ) : (
        <Form method="post" className="w-full max-w-md bg-white rounded shadow p-6">
          {/* Honeypot field - hidden from users but bots will fill it */}
          <input 
            type="text" 
            name="website" 
            className="hidden" 
            tabIndex={-1} 
            autoComplete="off"
            aria-hidden="true"
          />
          
          {comic && (
            <>
              <div className="mb-4 pb-4 border-b">
                <span className="font-medium">Comic:</span> {comic.title}
              </div>
              <input type="hidden" name="comicId" value={comic.id} />
            </>
          )}

          <div className="mb-4">
            <label className="block mb-2 font-medium" htmlFor="type">Type of Issue <span className="text-red-500">*</span></label>
            <select id="type" name="type" className="w-full border rounded p-2" required>
              <option value="">Select an issue type</option>
              <option value="technical">Technical Problem</option>
              <option value="copyright">Copyright Violation</option>
              <option value="harmful">Harmful/Pornographic Content</option>
              <option value="ai">Suspected AI-Generated Images</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium" htmlFor="subject">Subject <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              id="subject" 
              name="subject" 
              className="w-full border rounded p-2" 
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium" htmlFor="email">Email Address <span className="text-red-500">*</span></label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              className="w-full border rounded p-2" 
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium" htmlFor="chapter">Chapter</label>
            <select 
              id="chapter" 
              name="chapter" 
              className="w-full border rounded p-2"
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setSelectedPageNumber(""); // Reset page when chapter changes
              }}
            >
              <option value="">Select a chapter</option>
              {chapters.map(ch => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium" htmlFor="page">Page</label>
            <select 
              id="page" 
              name="page" 
              className="w-full border rounded p-2"
              value={selectedPageNumber}
              onChange={(e) => setSelectedPageNumber(e.target.value)}
              disabled={!selectedChapterId}
            >
              <option value="">Select a page</option>
              {selectedChapter && (() => {
                if (comic?.doubleSpread) {
                  return selectedChapter.pages
                    .filter(p => (p.number - 1) % 2 === 0)
                    .map(p => {
                      const maxPage = selectedChapter.pages[selectedChapter.pages.length - 1]?.number ?? p.number;
                      const endPage = p.number + 1 <= maxPage ? p.number + 1 : p.number;
                      return (
                        <option key={p.number} value={p.number}>
                          {p.number}–{endPage}
                        </option>
                      );
                    });
                } else {
                  return selectedChapter.pages.map(p => (
                    <option key={p.number} value={p.number}>
                      Page {p.number}
                    </option>
                  ));
                }
              })()}
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium" htmlFor="description">Description <span className="text-red-500">*</span></label>
            <textarea 
              id="description" 
              name="description" 
              className="w-full border rounded p-2" 
              rows={5} 
              placeholder="Please provide details about the issue"
              required
            />
          </div>

          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Submit
          </button>
        </Form>
        )}
      </main>
    </>
  );
}
