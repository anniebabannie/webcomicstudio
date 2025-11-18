-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'About',
    "linkText" TEXT NOT NULL DEFAULT 'About',
    "html" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "comicId" TEXT NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SitePage_comicId_idx" ON "SitePage"("comicId");

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_comicId_slug_key" ON "SitePage"("comicId", "slug");

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
