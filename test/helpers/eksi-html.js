const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]);

/** Ekşi'nin entry içi dış link biçimi. */
export const link = (href, text = href) =>
  `<a rel="nofollow noopener" class="url" target="_blank" href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;

/** Gerçek <li> yapısı. `content` ham HTML'dir. */
export function entryHtml({ id, author = 'deneme yazar', date = '01.01.2026 10:00', content = '' }) {
  const nick = author.replaceAll(' ', '-');
  return `
<li data-id="${id}" data-author="${escapeHtml(author)}" data-author-id="1" data-flags="share report vote" data-isfavorite="false" data-favorite-count="0" id="entry-item" data-show="true">
  <div class="content">
    ${content}
  </div><span class="read-more-link-wrapper"><a>devamını okuyayım</a></span>
  <footer>
    <div class="feedback-container"><div class="feedback"></div></div>
    <div class="info">
      <div class="entry-footer-bottom">
        <div class="footer-info">
          <div id="entry-nick-container">
            <div id="entry-author"><a class="entry-author" href="/biri/${escapeHtml(nick)}">${escapeHtml(author)}</a></div>
          </div>
          <div><a class="entry-date permalink" href="/entry/${id}">${escapeHtml(date)}</a></div>
        </div>
      </div>
    </div>
  </footer>
  <div class="comment-summary"><div class="comment-pages"></div></div>
</li>`;
}

/** Başlık sayfası; count > 1 ise pager eklenir. */
export function topicPageHtml({
  id = '1000001',
  title = 'deneme başlığı',
  slug = 'deneme-basligi',
  current = 1,
  count = 1,
  entries = [],
} = {}) {
  const pager = count > 1
    ? `<div class="pager" data-currentpage="${current}" data-pagecount="${count}"><select><option selected="selected">${current}</option></select>/<a href="?p=${count}" title="son sayfa" class="last">${count}</a></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)} - ekşi sözlük</title></head>
<body class="light-theme theme-enabled">
<div id="main"><div id="content"><section id="content-body">
<div id="topic">
  <h1 id="title" data-title="${escapeHtml(title)}" data-id="${id}" data-slug="${slug}">
    <a href="/${slug}--${id}" itemprop="url"><span itemprop="name">${escapeHtml(title)}</span></a></h1>
  <div class="clearfix sub-title-container"><div class="sub-title-menu"></div>${pager}<div style="clear:both"></div></div>
  <ul id="entry-item-list">
    ${entries.map(entryHtml).join('\n')}
  </ul>
</div>
</section></div></div>
</body></html>`;
}

/** /img/<id> sayfası. */
export function imagePageHtml({ ogImage = null, imageSrc = null } = {}) {
  return `<!DOCTYPE html>
<html><head>
  <meta property="og:site_name" content="ekşi sözlük">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
</head><body>
  <div id="content">
    ${imageSrc ? `<a id="image-zoom" href="${escapeHtml(imageSrc)}"><img id="image" src="${escapeHtml(imageSrc)}"></a>` : ''}
  </div>
</body></html>`;
}
