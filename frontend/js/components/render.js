// Render components
import { $, $$, escapeHtml, formatDate } from '../utils.js';
import { state } from '../state.js';
import API from '../api.js';
import { openPreview } from './preview.js';
import { openDeleteSourceModal } from './modal.js';
import { showToast } from './toast.js';

let goToPageCallback = null;
let loadArticlesCallback = null;

export function setGoToPageCallback(fn) { goToPageCallback = fn; }
export function setLoadArticlesCallback(fn) { loadArticlesCallback = fn; }

function goToPage(page) {
    if (goToPageCallback) goToPageCallback(page);
}

function loadArticles() {
    if (loadArticlesCallback) loadArticlesCallback();
}

export function renderSources() {
    const list = $('#sourceList');
    if (!list) return;

    let html =
        '<div class="source-item' + (state.currentSource === 'all' ? ' active' : '') + '" data-source-id="all">' +
        '<div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>' +
        '<span class="name">全部文章</span></div>';

    html += state.sources.map(function (source) {
        const isActive = String(state.currentSource) === String(source.id);
        const metaParts = [];
        if (source.article_count !== undefined) {
            metaParts.push(source.article_count + '篇');
        }
        if (source.last_fetched) {
            const relativeTime = formatDate(source.last_fetched);
            if (relativeTime) metaParts.push(relativeTime + '前');
        }
        const metaHtml = metaParts.length > 0 ? '<span class="source-meta">' + metaParts.join(' · ') + '</span>' : '';
        return '<div class="source-item' + (isActive ? ' active' : '') + '" data-source-id="' + source.id + '">' +
            '<div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg></div>' +
            '<div class="source-info"><span class="name">' + escapeHtml(source.name) + '</span>' + metaHtml + '</div>' +
            '<button class="delete-btn" data-delete-id="' + source.id + '" aria-label="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
            '</div>';
    }).join('');

    list.innerHTML = html;

    $$('.source-item').forEach(function (item) {
        item.addEventListener('click', function (e) {
            if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                const id = e.target.closest('.delete-btn').dataset.deleteId;
                openDeleteSourceModal(id);
                return;
            }
            selectSource(item.dataset.sourceId);
        });
    });
}

export function renderArticles() {
    const grid = $('#articlesGrid');
    const pagination = $('#pagination');
    if (!grid || !pagination) return;

    if (state.articles.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><h3>暂无文章</h3><p>添加订阅源开始阅读</p></div>';
        pagination.innerHTML = '';
        return;
    }

    const cardHtml = state.articles.map(function (article, index) {
        const isRead = article.ai_read || article.read;
        const badgeClass = isRead ? 'read' : 'unread';
        const badgeText = isRead ? '已读' : '未读';
        const title = article.title || '无标题';
        const sourceName = article.source_name || article.source || '未知来源';
        const dateStr = formatDate(article.published_at);

        let coverHtml;
        if (article.cover_path) {
            coverHtml = '<img src="' + escapeHtml(article.cover_path) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<svg viewBox=\\\'0 0 24 24\\\' fill=\\\'none\\\' stroke=\\\'currentColor\\\' stroke-width=\\\'2\\\'><path d=\\\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\\'/><polyline points=\\\'14 2 14 8 20 8\\\'/></svg>\'">';
        } else {
            coverHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }

        return '<article class="article-card" data-article-id="' + article.id + '" style="animation-delay:' + (index * 0.06) + 's">' +
            '<div class="cover">' + coverHtml + '</div>' +
            '<div class="content">' +
            '<h3 class="title">' + escapeHtml(title) + '</h3>' +
            (dateStr ? '<div class="date">' + escapeHtml(dateStr) + '</div>' : '') +
            '<div class="meta">' +
            '<span class="source">' + escapeHtml(sourceName) + '</span>' +
            '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div></div></article>';
    }).join('');
    grid.innerHTML = cardHtml;

    $$('.article-card').forEach(function (card) {
        card.addEventListener('click', function () {
            openPreview(parseInt(card.dataset.articleId));
        });
    });

    renderPagination();
}

export function renderPagination() {
    const pagination = $('#pagination');
    if (!pagination) return;

    const prevDisabled = state.currentPage <= 1 ? 'disabled' : '';
    const nextDisabled = state.currentPage >= state.totalPages ? 'disabled' : '';
    const totalPages = state.totalPages;
    const currentPage = state.currentPage;
    const maxVisiblePages = 5;

    let pagesHtml = '';
    if (totalPages <= maxVisiblePages + 2) {
        for (let i = 1; i <= totalPages; i++) {
            pagesHtml += '<button class="' + (i === currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }
    } else {
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        if (startPage > 1) {
            pagesHtml += '<button data-page="1">1</button>';
            if (startPage > 2) pagesHtml += '<span class="page-ellipsis">...</span>';
        }
        for (let i = startPage; i <= endPage; i++) {
            pagesHtml += '<button class="' + (i === currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pagesHtml += '<span class="page-ellipsis">...</span>';
            pagesHtml += '<button data-page="' + totalPages + '">' + totalPages + '</button>';
        }
    }

    pagination.innerHTML =
        '<div class="pagination-controls">' +
        '<button ' + prevDisabled + ' data-page="' + (currentPage - 1) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>上一页</button>' +
        '<div class="pagination-pages">' + pagesHtml + '</div>' +
        '<button ' + nextDisabled + ' data-page="' + (currentPage + 1) + '">下一页<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
        '</div>' +
        '<div class="pagination-size">' +
        '<label>每页:</label>' +
        '<select id="pageSizeSelect">' +
        '<option value="12"' + (state.pageSize === 12 ? ' selected' : '') + '>12篇</option>' +
        '<option value="24"' + (state.pageSize === 24 ? ' selected' : '') + '>24篇</option>' +
        '<option value="48"' + (state.pageSize === 48 ? ' selected' : '') + '>48篇</option>' +
        '</select>' +
        '</div>' +
        '<div class="pagination-jump">' +
        '<label>跳转:</label>' +
        '<input type="number" id="pageJumpInput" min="1" max="' + totalPages + '" value="' + currentPage + '">' +
        '<button id="pageJumpBtn">确定</button>' +
        '</div>';

    $$('.pagination-pages button').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page >= 1 && page <= state.totalPages) goToPage(page);
        });
    });

    $$('.pagination-controls > button').forEach(function (btn) {
        if (!btn.dataset.page) return;
        btn.addEventListener('click', function () {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page >= 1 && page <= state.totalPages) goToPage(page);
        });
    });

    const pageSizeSelect = $('#pageSizeSelect');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function () {
            state.pageSize = parseInt(pageSizeSelect.value);
            state.currentPage = 1;
            loadArticles();
        });
    }

    const pageJumpBtn = $('#pageJumpBtn');
    const pageJumpInput = $('#pageJumpInput');
    if (pageJumpBtn && pageJumpInput) {
        pageJumpBtn.addEventListener('click', function () {
            const page = parseInt(pageJumpInput.value);
            if (!isNaN(page) && page >= 1 && page <= state.totalPages) goToPage(page);
        });
        pageJumpInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const page = parseInt(pageJumpInput.value);
                if (!isNaN(page) && page >= 1 && page <= state.totalPages) goToPage(page);
            }
        });
    }
}

export function selectSource(id) {
    state.currentSource = id;
    state.currentPage = 1;
    renderSources();
    loadArticles();
    if (id !== 'all') {
        API.fetchSource(id).then(function () { loadArticles(); }).catch(function () {
            showToast('获取订阅源文章失败', 'error');
        });
    }
}