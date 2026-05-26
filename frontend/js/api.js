// API Layer for RSS Reader
const API = {
    getSources: () => fetch('/api/sources').then(r => {
        if (!r.ok) throw new Error('Failed to load sources');
        return r.json();
    }),

    addSource: (name, url) => fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
    }).then(r => r.json().then(data => {
        if (!r.ok) throw new Error(data.error || 'Failed to add source');
        return data;
    })),

    deleteSource: (id) => fetch(`/api/sources/${id}`, { method: 'DELETE' })
        .then(r => { if (!r.ok) throw new Error('Failed to delete source'); return r.json(); }),

    fetchSource: (id) => fetch(`/api/sources/${id}/fetch`, { method: 'POST' })
        .then(r => { if (!r.ok) throw new Error('Failed to fetch source'); return r.json(); }),

    getArticles: (page, sourceId, keyword, pageSize) => {
        const params = new URLSearchParams();
        if (page) params.set('page', page);
        if (sourceId && sourceId !== 'all') params.set('source_id', sourceId);
        if (keyword) params.set('keyword', keyword);
        params.set('limit', pageSize || 12);
        return fetch(`/api/articles?${params}`).then(r => {
            if (!r.ok) throw new Error('Failed to load articles');
            return r.json();
        });
    },

    getArticleContent: (id) => fetch(`/api/articles/${id}/content`).then(r => {
        if (!r.ok) throw new Error('Failed to load article');
        return r.json();
    }),

    markAsRead: (id) => fetch(`/api/articles/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_read: true })
    }).then(r => { if (!r.ok) throw new Error('Failed to update article'); return r.json(); }),

    markAllAsRead: (sourceId, keyword) => fetch('/api/articles/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_id: sourceId !== 'all' ? sourceId : undefined,
            keyword: keyword || undefined
        })
    }).then(r => { if (!r.ok) throw new Error('Failed to mark all as read'); return r.json(); })
};
export default API;