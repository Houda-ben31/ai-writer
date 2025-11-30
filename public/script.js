// ========================
// 🔹 تعريف المتغيرات العامة
// ========================
let currentCategory = '1';
let apiKey = localStorage.getItem('gemini_api_key') || '';
let wpCredentials = {};
// يحدد BASE_URL تلقائيًا حسب مكان فتح الصفحة
const BASE_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:3000'   // إذا كنت تعمل محليًا
  : 'https://ai-writer-sgka.onrender.com'; // السيرفر على Render

// ========================
// 🔹 دالة تنظيف المقال HTML
// ========================
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

// ========================
// 🔹 عند تحميل الصفحة
// ========================
document.addEventListener('DOMContentLoaded', () => {
  // 1️⃣ تفعيل بطاقات التصنيف
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentCategory = card.dataset.category;
      document.getElementById('customTopic').classList.toggle('hidden', currentCategory !== '4');
    });
  });

  // 2️⃣ إظهار الواجهة الرئيسية إذا وجد API Key
  if (apiKey) toggleMainUI();
});
 
 
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
// ===============================
// استعادة المقال المحفوظ بعد تسجيل الدخول
// ===============================
window.addEventListener('DOMContentLoaded', async () => {
  // استرجاع بيانات WordPress لو موجودة
  const savedWp = sessionStorage.getItem('wpCredentials');
  if (savedWp) {
    wpCredentials = JSON.parse(savedWp);
    console.log('📦 تم استعادة بيانات WordPress من الجلسة');
  }

  // تحقق من حالة تسجيل الدخول
  await checkAuthStatus();

  // تحقق إن كنا عائدين من تسجيل الدخول
  const isFromAuth = sessionStorage.getItem('returnFromAuth') === 'true';
  sessionStorage.removeItem('returnFromAuth'); // حذف العلامة بعد استخدامها

  // لو في مقال محفوظ
  const pending = localStorage.getItem('pendingPost');
  if (isFromAuth && pending) {
    const container = document.getElementById('articlesOutput');
    if (!container) {
      console.warn('⚠️ لم يتم العثور على عنصر articlesOutput لعرض المقال المستعاد.');
      return;
    }

    const { title, content, topic = '', language = 'ar' } = JSON.parse(pending);
    console.log('📄 تم استعادة المقال بعد تسجيل الدخول');

    // تحديد حالة تسجيل الدخول
    const isLoggedIn = true;
    const fileName = sanitizeFileName(title);
    const cleanedContent = cleanHTMLContent(content, language);

    // عرض المقال مباشرة في الصفحة
    displayArticleInPage(
      container,
      0,
      title,
      cleanedContent,
      '#',
      fileName,
      isLoggedIn,
      topic,
      language
    );

    alert('✅ تم استعادة المقال بعد تسجيل الدخول.');
    localStorage.removeItem('pendingPost'); // حذف المقال بعد العرض
  }
});

// ===============================
// 2️⃣ وظيفة توليد المقال
// ===============================
async function generateArticleWithProgress(topic, index, language) {
  showLoading();
  resetProgress();

  updateProgress(10);

const response = await fetch(`${BASE_URL}/generate-article`, {    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, language }),
  });

  updateProgress(40);

  const articleData = await response.json();
 const { title, content } = articleData;

   updateProgress(70);

  const articleUrl = '#';
  const fileName = `article_${index + 1}`;

   const isLoggedIn = await checkIfLoggedIn();

  displayArticleInPage(
    document.getElementById('articlesOutput'),
    index,
    title,
    content,
    articleUrl,
    fileName,
    isLoggedIn,
    topic,
    language
  );

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
 
function closeBlogModal() {
  document.getElementById('blogModal').style.display = 'none';
  document.getElementById('blogList').innerHTML = '';
}
 // ✅ عرض المقال مع العنوان المُحسن مسبقًا
function displayArticleInPage(container, index, title, contentHtml, downloadUrl, fileName, isLoggedIn, topic, language) {
  const articleCard = document.createElement('div');
  articleCard.className = 'article-card';

  const cleanTitle = stripHTML(title);
  const suggestedTitle = makeSEOFriendlyTitle(cleanTitle);

  // ===== العنوان وحقل تعديل العنوان =====
  const h2 = document.createElement('h2');
  h2.textContent = suggestedTitle;

  const seoInput = document.createElement('input');
  seoInput.type = 'text';
  seoInput.className = 'seo-title-input';
  seoInput.value = suggestedTitle;
  seoInput.placeholder = "📝 يمكنك تعديل العنوان لتحسين السيو";

  // ===== محتوى المقال =====
  const articleContent = document.createElement('div');
  articleContent.className = 'article-content';
  articleContent.innerHTML = contentHtml; 

  // ===== أزرار التحكم =====
  const actions = document.createElement('div');
  actions.className = 'article-actions';

  const downloadBtn = document.createElement('a');
  downloadBtn.href = '#';
  downloadBtn.className = 'download-btn';
  downloadBtn.dataset.filename = fileName;
  downloadBtn.textContent = '💾 تحميل TXT';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = '📋 نسخ المقال';

  const publishBtn = document.createElement('button');
  publishBtn.className = 'publish-btn';
  publishBtn.dataset.index = index;
  publishBtn.textContent = '📤 نشر إلى Blogger';

  const publishWpBtn = document.createElement('button');
  publishWpBtn.className = 'publish-wordpress-btn';
  publishWpBtn.dataset.index = index;
  publishWpBtn.textContent = 'نشر في WordPress';

  actions.append(downloadBtn, copyBtn, publishBtn, publishWpBtn);

  // ===== رابط أسفل المقال =====
  const footerDiv = document.createElement('div');
  footerDiv.style.textAlign = 'center';
  footerDiv.style.marginTop = '20px';

  const footerLink = document.createElement('a');
  footerLink.href = 'https://www.seoanalyzertool.online';
  footerLink.target = '_blank';
  footerLink.textContent = '🔗 زوروا موقعنا: ribhonline - أدوات مفيدة';
  footerLink.style.cssText = `
    display:inline-block;
    background-color:#28a745;
    color:white;
    padding:10px 20px;
    border-radius:8px;
    font-weight:bold;
    text-decoration:none;
    box-shadow:0 2px 6px rgba(0,0,0,0.2);
    transition:background 0.3s ease;
  `;
  footerLink.addEventListener('mouseover', () => footerLink.style.backgroundColor = '#218838');
  footerLink.addEventListener('mouseout', () => footerLink.style.backgroundColor = '#28a745');

  footerDiv.appendChild(footerLink);

  // ===== دمج العناصر =====
  articleCard.append(h2, seoInput, articleContent, actions, footerDiv);
  container.appendChild(articleCard);

  // ===== الأحداث =====

  // تحميل المقال كملف TXT
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const temp = document.createElement('div');
    temp.innerHTML = contentHtml;
    let plainText = temp.innerText.trim();
    plainText += `\n\n🔗 زوروا موقعنا: ribhonline - أدوات مفيدة\nhttps://www.seoanalyzertool.online`;
    downloadAsText(fileName, plainText);
  });

  // نسخ المقال
  copyBtn.addEventListener('click', () => copyArticleToClipboard(contentHtml, copyBtn));

  // نشر المقال إلى Blogger
  publishBtn.addEventListener('click', async () => {
    publishBtn.disabled = true;
    publishBtn.textContent = '⏳ جاري التحقق...';

    const customTitle = seoInput.value.trim() || suggestedTitle;

    const authCheck = await fetch(`${BASE_URL}/auth/status`, { credentials: 'include' });
    const authStatus = await authCheck.json();

    if (!authStatus.loggedIn) {
      // ✅ حفظ المقال مؤقتًا
      localStorage.setItem('pendingPost', JSON.stringify({
        title: customTitle,
        content: contentHtml,
        topic: topic || '',
        language: language || 'ar'
      }));
      sessionStorage.setItem('returnFromAuth', 'true');

      publishBtn.disabled = false;
      publishBtn.textContent = '📤 نشر إلى Blogger';

      // ✅ إرسال رابط الصفحة الحالي ليعود المستخدم إليه بعد تسجيل الدخول
      const currentUrl = window.location.href;
      window.location.href = `${BASE_URL}/auth?redirect=${encodeURIComponent(currentUrl)}`;
      return;
    }

    showBlogSelectorAndPublish(customTitle, contentHtml, topic, language);

    publishBtn.disabled = false;
    publishBtn.textContent = '📤 نشر إلى Blogger';
  });

  // نشر في WordPress
  publishWpBtn.addEventListener('click', () => openWpModal(index));
}

// ✅ دالة اختيار المدونة والنشر
async function showBlogSelectorAndPublish(title, content, button) {
  try {
    // 1️⃣ جلب قائمة المدونات
    const res = await fetch(`${BASE_URL}/blogs`, { credentials: 'include' });
    const data = await res.json();

    if (!data.blogs || data.blogs.length === 0) {
      alert('❌ لم يتم العثور على أي مدونة على حسابك.');
      button.disabled = false;
      button.textContent = '📤 نشر إلى Blogger';
      return;
    }

    // 2️⃣ إنشاء نافذة منبثقة لاختيار المدونة
    const modal = document.createElement('div');
    modal.className = 'blog-selector-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>اختر مدونة للنشر</h3>
        <ul class="blogs-list"></ul>
        <button class="close-btn">إلغاء</button>
      </div>
    `;
    document.body.appendChild(modal);

    const listDiv = modal.querySelector('.blogs-list');

    // 3️⃣ إنشاء عنصر <li> لكل مدونة
    data.blogs.forEach(blog => {
      const li = document.createElement('li');
      li.textContent = blog.name;
      li.style.cursor = 'pointer';
      li.style.padding = '8px';
      li.style.borderBottom = '1px solid #ddd';

      li.addEventListener('click', async () => {
        li.textContent = '⏳ جاري النشر...';
        li.style.pointerEvents = 'none';

        // 4️⃣ النشر مباشرة عند الضغط على المدونة
        const publishRes = await fetch(`${BASE_URL}/publish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, blogId: blog.id }),
        });

        const result = await publishRes.json();
        if (publishRes.ok && result.url) {
          alert(`✅ تم نشر المقال بنجاح!\nرابط المقال: ${result.url}`);
        } else {
          alert(`❌ فشل النشر: ${result.error || 'خطأ غير معروف'}`);
        }

        document.body.removeChild(modal);
        button.disabled = false;
        button.textContent = '📤 نشر إلى Blogger';
      });

      listDiv.appendChild(li);
    });

    // 5️⃣ زر الإغلاق
    modal.querySelector('.close-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
      button.disabled = false;
      button.textContent = '📤 نشر إلى Blogger';
    });

  } catch (err) {
    console.error('خطأ في النشر:', err);
    alert('❌ حدث خطأ أثناء محاولة النشر.');
    button.disabled = false;
    button.textContent = '📤 نشر إلى Blogger';
  }
}


function showToastWithLink(message, link) {
  // إزالة جميع التوستات القديمة
  document.querySelectorAll('.toast-popup').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'toast-popup';

  // نص الرسالة
  const span = document.createElement('span');
  span.textContent = message; // آمن ضد XSS

  // الرابط
  const a = document.createElement('a');
  a.href = link;
  a.target = '_blank';
  a.textContent = '👁️ عرض المقال';

  toast.appendChild(span);
  toast.appendChild(a);

  document.body.appendChild(toast);

  // إزالة التوست بعد 6 ثوانٍ
  setTimeout(() => {
    toast.remove();
  }, 6000);
}

 
function copyArticleToClipboard(htmlContent, button) {
  const tempElement = document.createElement('div');
  tempElement.innerHTML = htmlContent;

let text = tempElement.innerText.trim();

// ✅ إضافة رابط موقعك في النهاية
text += `\n\n🔗 زوروا موقعنا: ribhonline - أدوات مفيدة\nhttps://www.seoanalyzertool.online`;

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
        <style>
          body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px; }
          .source-link {
            margin-top: 50px;
            text-align: center;
            font-weight: bold;
            color: #007bff;
          }
        </style>
      </head>
      <body>
        ${htmlContent}

        <div class="source-link">
          🔗 زوروا موقعنا: 
          <a href="https://www.seoanalyzertool.online" target="_blank">ribhonline - أدوات مفيدة</a>
        </div>
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
    const res = await fetch('https://ai-writer-sgka.onrender.com/auth/status', { credentials: 'include' });
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
        window.location.href = "https://ai-writer-sgka.onrender.com/auth";
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
 