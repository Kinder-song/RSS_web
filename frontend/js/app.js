import API from './api.js';
import { state, cancelPendingRequests, currentRequestId } from './state.js';
import { $, $$, escapeHtml, formatDate } from './utils.js';
import { showToast } from './components/toast.js';
import { initPreviewWindow, initDrag, initResize, openPreview, closePreview } from './components/preview.js';
import { openAddSourceModal, closeAddSourceModal, openDeleteSourceModal, closeDeleteSourceModal, confirmDeleteSource, addSource, setLoadSourcesCallback, setLoadArticlesCallback } from './components/modal.js';
import { renderSources, renderArticles, renderPagination, selectSource, setGoToPageCallback, setLoadArticlesCallback as setRenderLoadArticlesCallback } from './components/render.js';

// ─── Theme ──────────────────────────────────────────────────────────────────

function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const sunIcon = $('.sun-icon');
    const moonIcon = $('.moon-icon');
    if (sunIcon && moonIcon) {
        sunIcon.style.display = theme === 'dark' ? 'none' : '';
        moonIcon.style.display = theme === 'dark' ? '' : 'none';
    }
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ─── Sidebar Persistence ────────────────────────────────────────────────────

function initSidebar() {
    const saved = localStorage.getItem('sidebarCollapsed');
    const sidebar = $('#sidebar');
    const toolbarToggle = $('#toolbarSidebarToggle');
    if (saved === 'true') {
        if (sidebar) sidebar.classList.add('collapsed');
        if (toolbarToggle) toolbarToggle.style.display = '';
    } else {
        if (toolbarToggle) toolbarToggle.style.display = 'none';
    }
}

function toggleSidebar() {
    const sidebar = $('#sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed);
    const toolbarToggle = $('#toolbarSidebarToggle');
    if (toolbarToggle) toolbarToggle.style.display = collapsed ? '' : 'none';
}

// ─── Core Functions ─────────────────────────────────────────────────────────

export function loadArticles() {
    cancelPendingRequests();
    const requestId = currentRequestId;

    const grid = $('#articlesGrid');
    if (grid) {
        grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>加载中...</span></div>';
    }
    API.getArticles(state.currentPage, state.currentSource, state.keyword, state.pageSize)
        .then(function (data) {
            if (requestId !== currentRequestId) return;
            if (data.articles) {
                state.articles = data.articles;
                state.total = data.total || 0;
                state.totalPages = Math.ceil(state.total / state.pageSize) || 1;
                renderArticles();
            }
        })
        .catch(function () {
            if (requestId !== currentRequestId) return;
            showToast('加载文章失败，请检查网络连接', 'error');
            if ($('#articlesGrid')) {
                $('#articlesGrid').innerHTML = '<div class="empty-state"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h3>加载失败</h3><p>请检查网络连接后重试</p></div>';
            }
            if ($('#pagination')) $('#pagination').innerHTML = '';
        });
}

export function goToPage(page) {
    state.currentPage = page;
    loadArticles();
    $('.articles-container').scrollTop = 0;
}

export function loadSources() {
    API.getSources().then(function (data) {
        state.sources = Array.isArray(data) ? data : [];
        renderSources();
        loadArticles();
    }).catch(function () {
        showToast('加载订阅源失败', 'error');
    });
}

function markAllAsRead() {
    if (state.articles.length === 0) return;
    API.markAllAsRead(state.currentSource, state.keyword).then(function (result) {
        state.articles.forEach(function (a) { a.ai_read = 1; });
        renderArticles();
        showToast('已全部标为已读 (' + (result.affected || state.articles.length) + '篇)', 'success');
    }).catch(function () {
        showToast('操作失败', 'error');
    });
}

function refreshArticles() {
    if (state.currentSource !== 'all') {
        const refreshBtn = $('#refreshBtn');
        if (refreshBtn) refreshBtn.classList.add('spinning');
        API.fetchSource(state.currentSource).then(function () {
            loadArticles();
            showToast('刷新完成', 'success');
        }).catch(function () {
            showToast('刷新失败', 'error');
        }).finally(function () {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        });
    } else {
        loadArticles();
    }
}

// ─── Search ─────────────────────────────────────────────────────────────────

let searchTimeout;
function handleSearch(e) {
    clearTimeout(searchTimeout);
    const value = e.target.value.trim();
    searchTimeout = setTimeout(function () {
        state.keyword = value;
        state.currentPage = 1;
        loadArticles();
    }, 400);
}

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

function initKeyboard() {
    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            if (e.key === 'Escape') {
                e.target.blur();
                closePreview();
                closeAddSourceModal();
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                closeDeleteSourceModal();
                closePreview();
                closeAddSourceModal();
                break;
            case 'r':
                if (!e.ctrlKey && !e.metaKey) refreshArticles();
                break;
            case 'n':
                if (!e.ctrlKey && !e.metaKey) openAddSourceModal();
                break;
            case 'ArrowLeft':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (state.currentPage > 1) goToPage(state.currentPage - 1);
                }
                break;
            case 'ArrowRight':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1);
                }
                break;
            case '/':
                e.preventDefault();
                const searchInput = $('#searchInput');
                if (searchInput) searchInput.focus();
                break;
            case 'b':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    toggleSidebar();
                }
                break;
            case 't':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    toggleTheme();
                }
                break;
        }
    });
}

// ─── Event Bindings ─────────────────────────────────────────────────────────

function bindEvents() {
    const sidebarToggle = $('#sidebarToggle');
    const themeToggle = $('#themeToggle');
    const searchInput = $('#searchInput');
    const addSourceBtn = $('#addSourceBtn');
    const cancelAddSource = $('#cancelAddSource');
    const confirmAddSource = $('#confirmAddSource');
    const previewClose = $('#previewClose');
    const previewOverlay = $('#previewOverlay');
    const addSourceModal = $('#addSourceModal');
    const markAllReadBtn = $('#markAllReadBtn');
    const refreshBtn = $('#refreshBtn');
    const toolbarSidebarToggle = $('#toolbarSidebarToggle');

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (toolbarSidebarToggle) toolbarSidebarToggle.addEventListener('click', toggleSidebar);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (addSourceBtn) addSourceBtn.addEventListener('click', openAddSourceModal);
    if (cancelAddSource) cancelAddSource.addEventListener('click', closeAddSourceModal);
    if (confirmAddSource) confirmAddSource.addEventListener('click', addSource);
    if (previewClose) previewClose.addEventListener('click', closePreview);
    if (markAllReadBtn) markAllReadBtn.addEventListener('click', markAllAsRead);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshArticles);

    if (previewOverlay) {
        previewOverlay.addEventListener('click', function (e) {
            if (e.target === previewOverlay) closePreview();
        });
    }
    if (addSourceModal) {
        addSourceModal.addEventListener('click', function (e) {
            if (e.target === addSourceModal) closeAddSourceModal();
        });
    }

    const deleteSourceModal = $('#deleteSourceModal');
    const cancelDeleteSource = $('#cancelDeleteSource');
    const confirmDeleteSourceBtn = $('#confirmDeleteSource');
    if (cancelDeleteSource) cancelDeleteSource.addEventListener('click', closeDeleteSourceModal);
    if (confirmDeleteSourceBtn) confirmDeleteSourceBtn.addEventListener('click', confirmDeleteSource);
    if (deleteSourceModal) {
        deleteSourceModal.addEventListener('click', function (e) {
            if (e.target === deleteSourceModal) closeDeleteSourceModal();
        });
    }

    if (addSourceBtn) addSourceBtn.title = '添加快捷键: N';
    if (refreshBtn) refreshBtn.title = '刷新快捷键: R';
    if (searchInput) searchInput.placeholder = '搜索文章标题或内容... (按 / 聚焦)';
}

// ─── Init ───────────────────────────────────────────────────────────────────

function init() {
    // Wire up callbacks for components that need to call app functions
    setGoToPageCallback(goToPage);
    setRenderLoadArticlesCallback(loadArticles);
    setLoadSourcesCallback(loadSources);

    initTheme();
    initSidebar();
    initPreviewWindow();
    initDrag();
    initResize();
    initKeyboard();
    bindEvents();
    loadSources();
}

document.addEventListener('DOMContentLoaded', init);