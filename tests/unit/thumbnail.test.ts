import { describe, it, expect } from 'vitest';
import { getThumbnailUrl } from '~/utils/thumbnail';

describe('getThumbnailUrl', () => {
  it('should insert -thumbnail before the file extension', () => {
    expect(getThumbnailUrl('image.webp')).toBe('image-thumbnail.webp');
    expect(getThumbnailUrl('photo.jpg')).toBe('photo-thumbnail.jpg');
    expect(getThumbnailUrl('picture.png')).toBe('picture-thumbnail.png');
  });

  it('should handle URLs with paths', () => {
    expect(getThumbnailUrl('https://example.com/images/cover.webp'))
      .toBe('https://example.com/images/cover-thumbnail.webp');
    
    expect(getThumbnailUrl('/uploads/comics/page1.jpg'))
      .toBe('/uploads/comics/page1-thumbnail.jpg');
  });

  it('should handle filenames with multiple dots', () => {
    expect(getThumbnailUrl('my.comic.cover.webp'))
      .toBe('my.comic.cover-thumbnail.webp');
    
    expect(getThumbnailUrl('file.backup.2024.png'))
      .toBe('file.backup.2024-thumbnail.png');
  });

  it('should return original string if no extension found', () => {
    expect(getThumbnailUrl('noextension')).toBe('noextension');
    expect(getThumbnailUrl('folder/')).toBe('folder/');
    expect(getThumbnailUrl('')).toBe('');
  });

  it('should handle S3-style URLs', () => {
    const s3Url = 'https://bucket.s3.amazonaws.com/comics/123/cover.webp';
    expect(getThumbnailUrl(s3Url))
      .toBe('https://bucket.s3.amazonaws.com/comics/123/cover-thumbnail.webp');
  });

  it('should handle query parameters and fragments', () => {
    expect(getThumbnailUrl('image.webp?v=123'))
      .toBe('image-thumbnail.webp?v=123');
    
    expect(getThumbnailUrl('photo.jpg#section'))
      .toBe('photo-thumbnail.jpg#section');
  });

  it('should handle uppercase extensions', () => {
    expect(getThumbnailUrl('IMAGE.WEBP'))
      .toBe('IMAGE-thumbnail.WEBP');
    
    expect(getThumbnailUrl('Photo.JPG'))
      .toBe('Photo-thumbnail.JPG');
  });

  it('should handle uncommon image formats', () => {
    expect(getThumbnailUrl('animation.gif'))
      .toBe('animation-thumbnail.gif');
    
    expect(getThumbnailUrl('vector.svg'))
      .toBe('vector-thumbnail.svg');
    
    expect(getThumbnailUrl('raw.tiff'))
      .toBe('raw-thumbnail.tiff');
  });
});
