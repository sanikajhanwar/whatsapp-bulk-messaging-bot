import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export async function extractDirectImageUrlFromImgBBViewer(viewerUrl) {
  try {
    const response = await fetch(viewerUrl);
    if (!response.ok) throw new Error(`Failed to fetch viewer URL: ${response.statusText}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    const directUrl = $('meta[property="og:image"]').attr('content');
    if (!directUrl) throw new Error('Direct image URL not found in viewer page');

    return directUrl;
  } catch (error) {
    console.error('Error extracting direct image URL:', error);
    throw error;
  }
}
