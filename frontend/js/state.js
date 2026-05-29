// State management for RSS Reader
const createState = () => ({
    sources: [],
    articles: [],
    currentSource: 'all',
    currentPage: 1,
    totalPages: 1,
    total: 0,
    keyword: '',
    density: {
        size: 'medium'  // 'large' | 'medium' | 'small'
    }
});

const state = createState();
export let currentRequestId = 0;

export function cancelPendingRequests() {
    currentRequestId++;
}

export function resetState() {
    const s = createState();
    Object.assign(state, s);
}

export { state };