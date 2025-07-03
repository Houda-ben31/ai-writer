let wpCredentials = {};
const BASE_URL = 'https://ai-writer-sgka.onrender.com';

function cleanHTMLContent(rawHtml, language = 'ar') {
  const direction = language === 'en' ? 'ltr' : 'rtl';
  const textAlign = direction === 'ltr' ? 'left' : 'right';
  const langAttr = language === 'en' ? 'en' : 'ar';

  const ARTICLE_STYLE = `
  <style>
  .article-body {
    direction: ${direction};
    text-align: ${textAlign};
    font-family: 'Tajawal', sans-serif;
    line-height: 1.8;
    font-size: 16px;
    color: #222;
    padding: 10px;
  }
  .article-body h1, .article-body h2, .article-body h3 {
    color: #0077cc;
    margin-top: 20px;
  }
  .article-body p {
    margin: 0 0 15px;
  }
  .article-body ul, .article-body ol {
    padding-left: 20px;
    margin-bottom: 15px;
  }
  .article-body ul li, .article-body ol li {
    margin-bottom: 10px;
  }
  .article-body a {
    color: #0066cc;
    text-decoration: underline;
  }
  .article-body a:hover {
    color: #004080;
    text-decoration: none;
  }
  </style>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rawHtml;

  ['html', 'head', 'style', 'meta', 'title', 'link'].forEach(tag => {
    const elements = tempDiv.getElementsByTagName(tag);
    while (elements[0]) {
      elements[0].parentNode.removeChild(elements[0]);
    }
  });

  const ps = tempDiv.querySelectorAll('p > p');
  ps.forEach(innerP => {
    const parent = innerP.parentNode;
    parent.replaceWith(innerP);
  });

  const cleaned = tempDiv.innerHTML.trim();

  return `${ARTICLE_STYLE}<div class="article-body" dir="${direction}" lang="${langAttr}">${cleaned}</div>`;
}

function generateMetaTags(content, topic, title, _unused = '', language = 'ar') {
  // ✅ لا تضف الوسوم إذا كانت موجودة مسبقًا في المقال
  if (content.includes('<meta name="description"') || content.includes('<script type="application/ld+json">')) {
    return ''; // تجاهل الإضافة
  }

  const plainText = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const description = plainText.slice(0, 160);
  const keywords = extractKeywords(topic, currentCategory, language);
const url = `https://bestsitesfor.com/articles/${encodeURIComponent(title.trim())}`;
  const image = 'https://bestsitesfor.com/assets/article-cover.jpg';
  const date = new Date().toISOString();

  return `
<!-- ✅ Meta SEO Tags -->
<meta name="description" content="${description} - اقرأ الآن لتتعرف على المزيد.">
<meta name="keywords" content="${keywords}">
<meta name="robots" content="index, follow">
<meta name="author" content="AI Writer Tool">

<!-- ✅ Open Graph Tags -->
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:locale" content="${language === 'en' ? 'en_US' : 'ar_AR'}">

<!-- ✅ Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">

<!-- ✅ JSON-LD Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${title}",
  "description": "${description}",
  "image": "${image}",
  "author": {
    "@type": "Organization",
    "name": "AI Writer Tool"
  },
  "publisher": {
    "@type": "Organization",
    "name": "AI Writer Tool",
    "logo": {
      "@type": "ImageObject",
      "url": "https://bestsitesfor.com/favicon.ico"
    }
  },
  "mainEntityOfPage": "${url}",
  "datePublished": "${date}"
}
</script>`;
}


function openWpModal(index) {
  document.getElementById('wordpressLoginModal').classList.remove('hidden');
  const saved = sessionStorage.getItem('wpCredentials');
  if (saved) {
    const creds = JSON.parse(saved);
    document.getElementById('wpUrl').value = creds.url || '';
    document.getElementById('wpUsername').value = creds.username || '';
    document.getElementById('wpPassword').value = creds.password || '';
  }

  document.getElementById('confirmWpLogin').onclick = () => {
    wpCredentials = {
      url: document.getElementById('wpUrl').value.trim(),
      username: document.getElementById('wpUsername').value.trim(),
      password: document.getElementById('wpPassword').value.trim(),
    };

    sessionStorage.setItem('wpCredentials', JSON.stringify(wpCredentials));

    if (!wpCredentials.url || !wpCredentials.username || !wpCredentials.password) {
      alert('يرجى إدخال جميع البيانات');
      return;
    }

    closeWpModal();
    publishToWordPress(index);
  };
}



function closeWpModal() {
  document.getElementById('wordpressLoginModal').classList.add('hidden');
}

 window.addEventListener('DOMContentLoaded', async () => {
  const savedWp = sessionStorage.getItem('wpCredentials');
  if (savedWp) {
    wpCredentials = JSON.parse(savedWp);
    console.log('📦 تم استعادة بيانات WordPress من الجلسة');
  }

  await checkAuthStatus();

  const pending = localStorage.getItem('pendingPost');
  if (pending) {
    const { title, content, language = 'ar' } = JSON.parse(pending);
    console.log('🔁 محاولة إعادة نشر المقال بعد تسجيل الدخول...');

    const result = await handleBloggerPublishing(title, content, language);

    if (result) {
      alert('✅ تم نشر المقال بعد تسجيل الدخول');
      window.open(result, '_blank');

      const isLoggedIn = true;
      const fileName = sanitizeFileName(title);
      const cleanedContent = cleanHTMLContent(content, language);
const articleUrl = result; // ← هذا هو رابط المقال

      displayArticleInPage(
        document.getElementById('articlesOutput'),
        0,
        title,
        cleanedContent,
        articleUrl,
        fileName,
        isLoggedIn
      );
    } else {
      alert('❌ فشل في النشر بعد تسجيل الدخول، يرجى المحاولة يدويًا.');
    }

    localStorage.removeItem('pendingPost');
  }
});

async function generateArticleWithProgress(topic, index, language) {
  showLoading();
  resetProgress();

  updateProgress(10); // البداية

  // 1. توليد العنوان والمحتوى
  const response = await fetch('/generate-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic, language }), // ← أضفنا اللغة
  });

  updateProgress(40);

  const articleData = await response.json();
  const { title, content } = articleData;

  // 2. بناء المحتوى بدون صورة
  const contentWithoutImage = content;

  updateProgress(70);

  // 3. عرض المقال في الواجهة
  const articleUrl = '#'; // مؤقت فقط
  const fileName = `article_${index + 1}`;

  // جلب حالة الدخول الحالية لاستخدامها عند العرض
  const isLoggedIn = await checkIfLoggedIn();

  displayArticleInPage(document.getElementById('output'), index, title, contentWithoutImage, articleUrl, fileName, isLoggedIn);

  updateProgress(100);
  showSuccess('✅ تم إنشاء المقال بنجاح!');
}


function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9_\u0600-\u06FF\- ]/g, '_').trim();
}

function generateArticleContent(title, body, description = '', keywords = '') {
  // يمكنك استخدام الوصف والكلمات المفتاحية داخل عناصر مخفية أو لإضافة ميتا داتا ديناميكية (إن أردت)
  
  return `
    <article>
      <header>
        <h1>${title}</h1>
        ${description ? `<p class="meta-description">${description}</p>` : ''}
        ${keywords ? `<p class="meta-keywords" style="display:none;">${keywords}</p>` : ''}
      </header>
      <section class="article-body">
        ${body}
      </section>
    </article>
  `;
}
 

async function selectBlogFromUser() {
  try {
    const res = await fetch('/blogs', { credentials: 'include' });
    const data = await res.json();

    if (!data.blogs || data.blogs.length === 0) {
      alert("❌ لا توجد مدونات في حسابك.");
      return null;
    }

    // 🟢 بناء القائمة النصية
    const blogOptions = data.blogs.map(blog => `${blog.name}::${blog.id}`);

    // 🟡 عرض prompt للمستخدم
    const choice = prompt(
      `📝 اختر رقم المدونة للنشر:\n` +
      blogOptions.map((opt, i) => `${i + 1}. ${opt.split('::')[0]}`).join('\n')
    );

    // 🔴 تحقق من صحة الاختيار
    const index = parseInt(choice);
    if (isNaN(index) || index < 1 || index > data.blogs.length) {
      alert("⚠️ رقم غير صالح.");
      return null;
    }

    // ✅ إعادة الـ blogId المختار
    return data.blogs[index - 1].id;

  } catch (err) {
    alert('❌ فشل في تحميل المدونات.');
    console.error(err);
    return null;
  }
}


async function showBlogSelectorAndPublish(title, content, button) {
  const blogId = await selectBlogFromUser();

  if (!blogId) {
    button.disabled = false;
    button.textContent = '📤 نشر إلى Blogger';
    return;
  }

  try {
    const res = await fetch('/publish', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, blogId })
    });

    const result = await res.json();
    if (result.url) {
      button.textContent = '✅ تم النشر!';
      button.style.backgroundColor = 'green';
      window.open(result.url, '_blank');
    } else {
      button.textContent = '❌ فشل النشر';
      button.disabled = false;
      button.style.backgroundColor = 'red';
    }

  } catch (err) {
    console.error('❌ فشل في النشر:', err);
    button.textContent = '❌ فشل النشر';
    button.disabled = false;
  }
}

// ✅ عرض المقال مع العنوان المُحسن مسبقًا
function displayArticleInPage(container, index, title, contentHtml, downloadUrl, fileName, isLoggedIn, topic, language) {
  const articleCard = document.createElement('div');
  articleCard.className = 'article-card';

const cleanTitle = stripHTML(title);
const suggestedTitle = makeSEOFriendlyTitle(cleanTitle);

  articleCard.innerHTML = `
    <h2>${suggestedTitle}</h2>
    <input type="text" class="seo-title-input" value="${suggestedTitle}" placeholder="📝 يمكنك تعديل العنوان لتحسين السيو">
    <div class="article-content">${contentHtml}</div>
    <div class="article-actions">
      <a href="#" class="download-btn" data-filename="${fileName}">💾 تحميل TXT</a>
      <button class="copy-btn">📋 نسخ المقال</button>
      <button class="publish-btn" data-index="${index}">📤 نشر إلى Blogger</button>
      <button class="publish-wordpress-btn" data-index="${index}">نشر في WordPress</button>
    </div>
  `;

  container.appendChild(articleCard);

   const downloadBtn = articleCard.querySelector('.download-btn');
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const fileName = downloadBtn.getAttribute('data-filename');
    downloadAsText(fileName, contentHtml);
  });

   const copyBtn = articleCard.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    copyArticleToClipboard(contentHtml, copyBtn);
  });

   const publishBtn = articleCard.querySelector('.publish-btn');
  publishBtn.addEventListener('click', async () => {
    publishBtn.disabled = true;
    publishBtn.textContent = '⏳ جاري التحقق...';

    const customTitle = articleCard.querySelector('.seo-title-input').value.trim() || suggestedTitle;
// تحقق من حالة تسجيل الدخول
const authCheck = await fetch('/auth/status', { credentials: 'include' });
const authStatus = await authCheck.json();

if (!authStatus.loggedIn) {
  publishBtn.disabled = false;
  publishBtn.textContent = '📤 نشر إلى Blogger';
  window.location.href = '/auth';
  return;
}


// إذا كان مسجلاً → اطلب منه اختيار مدونة وانشر
const resultUrl = await showBlogSelectorAndPublish(customTitle, contentHtml, publishBtn);


    if (resultUrl) {
      publishBtn.textContent = '✅ تم النشر!';
      publishBtn.style.backgroundColor = 'green';
      publishBtn.style.cursor = 'default';
    } else {
      publishBtn.textContent = '❌ فشل النشر';
      publishBtn.disabled = false;
      publishBtn.style.backgroundColor = 'red';
    }
  });

  const publishWpBtn = articleCard.querySelector('.publish-wordpress-btn');
  publishWpBtn.addEventListener('click', () => {
    openWpModal(index);
  });
}

function copyArticleToClipboard(htmlContent, button) {
  const tempElement = document.createElement('div');
  tempElement.innerHTML = htmlContent;

  const text = tempElement.innerText;

  navigator.clipboard.writeText(text).then(() => {
    button.textContent = '✅ تم النسخ!';
    button.disabled = true;

    // تأثير بصري على كرت المقال
    const card = button.closest('.article-card');
    if (card) {
      card.classList.add('copied-highlight');
      setTimeout(() => card.classList.remove('copied-highlight'), 1500);
    }
 
    setTimeout(() => {
      button.textContent = '📋 نسخ المقال';
      button.disabled = false;
    }, 2000);
  }).catch(err => {
    console.error('فشل النسخ:', err);
    button.textContent = '❌ فشل النسخ';
    setTimeout(() => {
      button.textContent = '📋 نسخ المقال';
    }, 2000);
  });
}


function downloadAsHTML(fileName, blobUrl) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${fileName}.html`;
  document.body.appendChild(a); // للتوافق مع بعض المتصفحات
  a.click();
  document.body.removeChild(a);
}

function downloadAsText(fileName, textContent) {
  const blob = new Blob([textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAsPDF(fileName, htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${fileName}</title>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print(); // المستخدم يختار "حفظ كـ PDF"
    document.body.removeChild(iframe);
  };
}

async function checkIfLoggedIn() {
  try {
    const res = await fetch(`${BASE_URL}/auth/status`, { credentials: 'include' });
    const data = await res.json();
    return data.loggedIn;
  } catch (err) {
    console.error('فشل التحقق من حالة الدخول:', err);
    return false;
  }
}



async function checkAuthStatus() { 
  try {
    const res = await fetch('https://ai-writer.onrender.com/auth/status', { credentials: 'include' });
    const data = await res.json();
    const authSection = document.getElementById('authSection');

    if (!authSection) return; // يتأكد من وجود العنصر

    if (data.loggedIn) {
       authSection.innerHTML = `
        <p>✅ أنت مسجل الدخول إلى Google. يمكنك النشر إلى Blogger مباشرة من كل مقال.</p>
      `;
    } 
    else {
      authSection.innerHTML = `
        <button id="loginBtn">🔐 تسجيل الدخول إلى Google للنشر على Blogger</button>
      `;

      document.getElementById('loginBtn').onclick = () => {
        window.location.href = "https://ai-writer.onrender.com/auth";
      };
    }
  } catch (err) {
    console.error('فشل التحقق من حالة الدخول:', err);
  }
}



function extractKeywordsForImage(text) {
  const stopWords = new Set([
    "في", "من", "على", "و", "عن", "إلى", "أن", "إن", "كان", "كانت",
    "هو", "هي", "مع", "كما", "هذا", "هذه", "ذلك", "تلك", "لكن", "أو",
    "أي", "كل", "بعض", "لم", "لا", "نعم", "هل"
  ]);
  
  const words = text.toLowerCase()
                    .replace(/[^\w\s\u0600-\u06FF]/g, '') // إزالة علامات الترقيم
                    .split(/\s+/)
                    .filter(w => w && !stopWords.has(w));
  
  return words.slice(0, 3).join(' ');
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
 