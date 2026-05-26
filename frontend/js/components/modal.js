// Modal components
import { $ } from '../utils.js';
import { state } from '../state.js';
import API from '../api.js';
import { showToast } from './toast.js';

let pendingDeleteId = null;

let loadSourcesCallback = null;
let loadArticlesCallback = null;

export function setLoadSourcesCallback(fn) { loadSourcesCallback = fn; }
export function setLoadArticlesCallback(fn) { loadArticlesCallback = fn; }

export function openDeleteSourceModal(id) {
    const modal = $('#deleteSourceModal');
    const nameSpan = $('#deleteSourceName');
    const source = state.sources.find(function (s) { return s.id == id; });
    if (!modal) return;
    pendingDeleteId = id;
    if (nameSpan) nameSpan.textContent = source ? source.name : '该订阅源';
    modal.classList.add('active');
}

export function closeDeleteSourceModal() {
    const modal = $('#deleteSourceModal');
    if (modal) modal.classList.remove('active');
    pendingDeleteId = null;
}

export function confirmDeleteSource() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    closeDeleteSourceModal();
    API.deleteSource(id).then(function () {
        if (state.currentSource == id) state.currentSource = 'all';
        if (loadSourcesCallback) loadSourcesCallback();
        else {
            // Fallback: reload page state
            import('../app.js').then(function(app) {
                if (app.loadSources) app.loadSources();
            });
        }
        showToast('订阅源已删除', 'success');
    }).catch(function () {
        showToast('删除失败', 'error');
    });
}

export function openAddSourceModal() {
    const modal = $('#addSourceModal');
    const nameInput = $('#sourceName');
    const urlInput = $('#sourceUrl');
    if (modal) modal.classList.add('active');
    if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    if (urlInput) urlInput.value = '';
}

export function closeAddSourceModal() {
    const modal = $('#addSourceModal');
    if (modal) modal.classList.remove('active');
}

export function addSource() {
    const nameInput = $('#sourceName');
    const urlInput = $('#sourceUrl');
    const name = nameInput ? nameInput.value.trim() : '';
    const url = urlInput ? urlInput.value.trim() : '';
    if (!name || !url) return;

    const confirmBtn = $('#confirmAddSource');
    if (confirmBtn) confirmBtn.disabled = true;

    API.addSource(name, url).then(function (newSource) {
        closeAddSourceModal();
        if (loadSourcesCallback) loadSourcesCallback();
        else {
            import('../app.js').then(function(app) {
                if (app.loadSources) app.loadSources();
            });
        }
        if (newSource && newSource.id) {
            API.fetchSource(newSource.id).then(function () {
                if (loadArticlesCallback) loadArticlesCallback();
                else {
                    import('../app.js').then(function(app) {
                        if (app.loadArticles) app.loadArticles();
                    });
                }
            });
        }
        showToast('订阅源添加成功', 'success');
    }).catch(function (err) {
        showToast(err.message || '添加失败', 'error');
    }).finally(function () {
        if (confirmBtn) confirmBtn.disabled = false;
    });
}