 let wpCredentials = {};
  function openWpModal(index) {
  document.getElementById('wordpressLoginModal').classList.remove('hidden');
  // تعبئة الحقول تلقائيًا إذا كانت البيانات موجودة
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

    // ✅ تخزين مؤقت في sessionStorage
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
   // ✅ استعادة بيانات WordPress من sessionStorage إن وُجدت
  const savedWp = sessionStorage.getItem('wpCredentials');
  if (savedWp) {
    wpCredentials = JSON.parse(savedWp);
    console.log('📦 تم استعادة بيانات WordPress من الجلسة');
  }
  // تحقق من حالة الدخول وتهيئة الواجهة
  await checkAuthStatus();

  // ثم حاول إعادة نشر مقال معلق إذا وجد
const pending = localStorage.getItem('pendingPost');
  if (pending) {
    const { title, content } = JSON.parse(pending);

    console.log('🔁 محاولة إعادة نشر المقال بعد تسجيل الدخول...');

 
 const result = await handleBloggerPublishing(title, content);

if (result) {
  alert('✅ تم نشر المقال بعد تسجيل الدخول');
  window.open(result, '_blank');

  const isLoggedIn = true;
  const fileName = sanitizeFileName(title);
  const articleUrl = result;

  displayArticleInPage(
    document.getElementById('articlesOutput'),
    0,
    title,
    content,
    articleUrl,
    fileName,
    isLoggedIn
  );

} else {
  alert('❌ فشل في النشر بعد تسجيل الدخول، يرجى المحاولة يدويًا.');
}

// ⛔️ هذا السطر يجب أن يكون هنا خارج if/else
localStorage.removeItem('pendingPost');

  }
});



async function generateArticleWithProgress(topic, index) {
  showLoading();
  resetProgress();

  updateProgress(10); // البداية

  // 1. توليد العنوان والمحتوى
  const response = await fetch('/generate-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
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
 

function displayArticleInPage(container, index, title, contentHtml, downloadUrl, fileName, isLoggedIn) {
  const articleCard = document.createElement('div');
  articleCard.className = 'article-card';

  articleCard.innerHTML = `
    <h2>${title}</h2>
    <div class="article-content">${contentHtml}</div>
    <div class="article-actions">
      <a href="#" class="download-btn" data-filename="${fileName}">💾 تحميل TXT</a>
      <button class="copy-btn">📋 نسخ المقال</button>
      <button class="publish-btn" data-index="${index}">📤 نشر إلى Blogger</button>
      <button class="publish-wordpress-btn" data-index="${index}">نشر في WordPress</button>

      </div>
  `;

  container.appendChild(articleCard);

  // زر التحميل
  const downloadBtn = articleCard.querySelector('.download-btn');
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const fileName = downloadBtn.getAttribute('data-filename');
    downloadAsText(fileName, contentHtml);
  });

  // زر النسخ
  const copyBtn = articleCard.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    copyArticleToClipboard(contentHtml, copyBtn);
  });

  // زر النشر
  const publishBtn = articleCard.querySelector('.publish-btn');
  publishBtn.addEventListener('click', async () => {
    publishBtn.disabled = true;
    publishBtn.textContent = '⏳ جاري التحقق...';

    const resultUrl = await handleBloggerPublishing(title, contentHtml, index);
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
   // زر النشر إلى WordPress
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
    const res = await fetch('https://ai-writer.onrender.com/auth/status', { credentials: 'include' });
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
 