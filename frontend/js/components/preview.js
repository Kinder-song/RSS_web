// Preview window components
import { $ } from '../utils.js';
import { state } from '../state.js';
import API from '../api.js';
import { formatDate, escapeHtml, $$ } from '../utils.js';
import { showToast } from './toast.js';

export function initPreviewWindow() {
    const saved = localStorage.getItem('previewWindow');
    if (saved) {
        try {
            const pos = JSON.parse(saved);
            const win = $('#previewWindow');
            if (win) {
                if (pos.left) win.style.left = pos.left + 'px';
                if (pos.top) win.style.top = pos.top + 'px';
                if (pos.width) { win.style.width = pos.width + 'px'; win.style.maxWidth = 'none'; }
                if (pos.height) { win.style.height = pos.height + 'px'; win.style.maxHeight = 'none'; }
                win.style.position = 'fixed';
                win.style.margin = '0';
            }
        } catch (e) { /* ignore */ }
    }
}

function savePreviewWindow() {
    const win = $('#previewWindow');
    if (!win) return;
    localStorage.setItem('previewWindow', JSON.stringify({
        left: win.offsetLeft,
        top: win.offsetTop,
        width: win.offsetWidth,
        height: win.offsetHeight
    }));
}

// Drag logic
let isDragging = false;
const dragOffset = { x: 0, y: 0 };

export function initDrag() {
    const previewHeader = $('#previewHeader');
    if (previewHeader) {
        previewHeader.addEventListener('mousedown', function (e) {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = $('#previewWindow').getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        });
    }

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        const win = $('#previewWindow');
        if (win) {
            win.style.left = Math.max(0, e.clientX - dragOffset.x) + 'px';
            win.style.top = Math.max(0, e.clientY - dragOffset.y) + 'px';
            win.style.maxWidth = 'none';
            win.style.maxHeight = 'none';
            win.style.position = 'fixed';
            win.style.margin = '0';
        }
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            savePreviewWindow();
        }
    });
}

// Resize logic
let isResizing = false;

export function initResize() {
    const resizeHandle = $('#resizeHandle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', function (e) {
            isResizing = true;
            e.preventDefault();
            e.stopPropagation();
        });
    }

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        const win = $('#previewWindow');
        if (win) {
            const rect = win.getBoundingClientRect();
            win.style.width = Math.max(400, e.clientX - rect.left) + 'px';
            win.style.height = Math.max(300, e.clientY - rect.top) + 'px';
            win.style.maxWidth = 'none';
            win.style.maxHeight = 'none';
        }
    });

    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            savePreviewWindow();
        }
    });
}

export function openPreview(id) {
    const overlay = $('#previewOverlay');
    const previewTitle = $('#previewTitle');
    const previewMeta = $('#previewMeta');
    const previewSummary = $('#previewSummary');
    const previewJump = $('#previewJump');
    const summaryCard = $('#summaryCard');

    if (!overlay) return;

    overlay.classList.add('active');
    if (previewTitle) previewTitle.textContent = '加载中...';
    if (previewMeta) previewMeta.textContent = '';
    if (previewSummary) {
        previewSummary.innerHTML = '<div class="summary-loading"><div class="shimmer-line"></div><div class="shimmer-line short"></div><div class="shimmer-line medium"></div><div class="shimmer-line short"></div></div>';
    }
    if (summaryCard) {
        summaryCard.style.animation = 'none';
        summaryCard.offsetHeight;
        summaryCard.style.animation = '';
    }

    if (previewJump) previewJump.onclick = null;

    API.getArticleContent(id).then(function (data) {
        if (previewTitle) previewTitle.textContent = data.title || '无标题';

        if (previewMeta) {
            const parts = [];
            if (data.source_name) parts.push(data.source_name);
            if (data.published_at) parts.push(formatDate(data.published_at));
            if (previewMeta) previewMeta.textContent = parts.join(' · ');
        }

        if (previewSummary) {
            if (data.summary) {
                previewSummary.innerHTML = '<p>' + escapeHtml(data.summary) + '</p>';
            } else {
                previewSummary.innerHTML = '<p style="color:var(--text-muted);text-align:center;">摘要生成中，请稍后再试...</p>';
            }
        }

        if (previewJump) {
            previewJump.onclick = function () {
                if (data.url) window.open(data.url, '_blank', 'noopener');
            };
        }

        const article = state.articles.find(function (a) { return a.id === id; });
        if (article) article.ai_read = 1;

        API.markAsRead(id).then(function () {
            $$('.article-card').forEach(function (card) {
                if (parseInt(card.dataset.articleId) === id) {
                    const badge = card.querySelector('.badge');
                    if (badge) {
                        badge.className = 'badge read';
                        badge.textContent = '已读';
                    }
                }
            });
        }).catch(function () { /* silent */ });
    }).catch(function () {
        if (previewTitle) previewTitle.textContent = '加载失败';
        if (previewSummary) previewSummary.innerHTML = '<div class="preview-error">加载失败，请稍后重试</div>';
        showToast('加载文章内容失败', 'error');
    });
}

export function closePreview() {
    const overlay = $('#previewOverlay');
    if (!overlay) return;
    overlay.classList.add('closing');
    overlay.addEventListener('transitionend', function handler() {
        overlay.removeEventListener('transitionend', handler);
        overlay.classList.remove('active', 'closing');
    }, { once: true });
    setTimeout(function () {
        overlay.classList.remove('active', 'closing');
    }, 400);
}