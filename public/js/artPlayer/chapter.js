/**
 * Handles chapter styling logic for the video player.
 * Dynamically generates and updates CSS styles for intro and outro segments.
 * 
 * Functions:
 * - getChapterStyles(intro, outro)
 *      → Builds CSS rules based on intro/outro timestamps.
 *      → Always applies highlight styles when intro/outro segments exist.
 * 
 * - updateChapterStyles(introStart, introEnd, outroStart, outroEnd)
 *      → Injects or updates a <style> tag in the document <head>.
 *      → Ensures chapter visuals (e.g., colored bars) stay in sync with the player’s timeline.
 * 
 * Usage:
 * import { getChapterStyles, updateChapterStyles } from './artPlayer/chapter.js';
 * updateChapterStyles(introStart, introEnd, outroStart, outroEnd);
 * 
 * Notes:
 * - No skip flags are used; styles apply automatically when intro/outro times are defined.
 * - Designed to integrate with Artplayer’s chapter rendering.
 */

export function getChapterStyles(intro, outro) {
  let styles = `
    .art-chapters {
        gap: 0px !important;
    }
  `;

  if (!intro || !outro) return styles;

  // both intro and outro exist
  if (
    intro.start !== 0 && intro.end !== 0 &&
    outro.start !== 0 && outro.end !== 0
  ) {
    styles += `
      .art-chapter:nth-child(2),
      .art-chapter:nth-child(4) {
          background-color: #fdd253;
          transform: scaleY(0.4);
      }
    `;
  }
  // only intro
  else if (
    intro.start !== 0 && intro.end !== 0 &&
    (outro.start === 0 || outro.end === 0)
  ) {
    styles += `
      .art-chapter:nth-child(2) {
          background-color: #fdd253;
          transform: scaleY(0.4);
      }
    `;
  }
  // only outro
  else if (
    (intro.start === 0 || intro.end === 0) &&
    outro.start !== 0 && outro.end !== 0
  ) {
    styles += `
      .art-chapter:nth-child(2) {
          background-color: #fdd253;
          transform: scaleY(0.4);
      }
    `;
  }

  return styles;
}

export function updateChapterStyles(introStart, introEnd, outroStart, outroEnd) {
  const intro = { start: introStart, end: introEnd };
  const outro = { start: outroStart, end: outroEnd };
  const chapterStyles = getChapterStyles(intro, outro);

  let styleElement = document.getElementById('chapter-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'chapter-styles';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = chapterStyles;
}
