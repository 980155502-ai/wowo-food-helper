import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button, Card, Icon, Tag } from '../src';
import amapIcon from './img/amap-logo.png';
import {
    sceneFilters,
    seedNotes,
    timeFilters,
    rideBandMax,
    rideBands,
    wowoRestaurants,
    type SceneFilter,
    type TimeFilter,
    type RideBand,
    type WowoRestaurant,
    type WowoSeedNote,
} from './wowoFoodData';
import './WowoFoodAssistant.css';

type ActiveScreen = 'finder' | 'loading' | 'results' | 'ranking' | 'detail';
type ResultMode = 'filtered' | 'random' | 'all';
type LoadingKind = 'filter' | 'random' | 'all';
type DetailBackTarget = 'results' | 'ranking';
type FilterSelection<T extends string> = T | '全部';
type VoteStore = Record<string, boolean>;
type ShopCommentStore = Record<string, ShopComment[]>;

interface ShopComment {
    id: string;
    text: string;
    createdAt: number;
}

interface CommentItem {
    id: string;
    text: string;
}

interface FilterState {
    time: FilterSelection<TimeFilter>;
    scene: FilterSelection<SceneFilter>;
    distance: FilterSelection<RideBand>;
}

interface RandomPick {
    restaurant: WowoRestaurant;
    helper: string;
}

type MealBadge = {
    label: 'A' | 'B' | 'C';
    title: '早餐' | '午餐' | '晚餐';
};

const loadingCopy: Record<LoadingKind, { title: string; body: string }> = {
    filter: {
        title: '正在从窝窝附近帮你找饭',
        body: '看一下距离、饭点和住户口味，马上端出来。',
    },
    random: {
        title: '正在帮你抽今天的签名菜馆',
        body: '把选择困难先放一边，让窝窝来拍板。',
    },
    all: {
        title: '正在整理附近餐馆名单',
        body: '把窝窝精选餐馆按骑行时间排好。',
    },
};

const VOTE_STORAGE_KEY = 'wowo-food-votes-v1';
const OLD_NOTE_STORAGE_KEY = 'wowo-food-notes-v1';
const FREE_NOTE_STORAGE_KEY = 'wowo-food-free-notes-v1';
const SHOP_COMMENT_STORAGE_KEY = 'wowo-food-shop-comments-v1';
const DEVICE_STORAGE_KEY = 'wowo-food-device-id-v1';
const FREE_NOTE_SHOP_MAX = 12;
const FREE_NOTE_TEXT_MAX = 28;
const SHOP_COMMENT_MAX = 36;
const COMMENT_PREVIEW_MAX = 28;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

type CloudVoteCounts = Record<string, number>;

interface VoteCountRow {
    restaurant_id: string;
    vote_count: number;
}

interface ShopCommentRow {
    id: string;
    restaurant_id: string;
    text: string;
    created_at: string;
}

interface FreeNoteRow {
    id: string;
    shop_name: string;
    text: string;
    created_at: string;
}

const supabase =
    SUPABASE_URL && SUPABASE_ANON_KEY
        ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
              auth: {
                  persistSession: false,
                  autoRefreshToken: false,
              },
          })
        : null;

const introStartImage = new URL('./assets/wowo/nanchang-flat-start-mobile.jpg', import.meta.url).href;
const introEndImage = new URL('./assets/wowo/nanchang-flat-end-mobile.jpg', import.meta.url).href;

const defaultFilters: FilterState = {
    time: '全部',
    scene: '全部',
    distance: '全部',
};

const readStorage = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;

    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

const writeStorage = (key: string, value: unknown) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Local storage is a progressive enhancement for this static H5.
    }
};

const getOrCreateDeviceId = () => {
    const existing = readStorage<string>(DEVICE_STORAGE_KEY, '');
    if (existing) return existing;

    const nextDeviceId =
        typeof window !== 'undefined' && window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    writeStorage(DEVICE_STORAGE_KEY, nextDeviceId);
    return nextDeviceId;
};

const normalizeVoteCounts = (voteCounts?: CloudVoteCounts) =>
    Object.fromEntries(
        Object.entries(voteCounts || {})
            .filter(([, value]) => Number.isFinite(value) && value >= 0)
            .map(([key, value]) => [key, Math.floor(value)])
    ) as CloudVoteCounts;

const normalizeShopComments = (comments?: ShopCommentStore): ShopCommentStore =>
    Object.fromEntries(
        Object.entries(comments || {}).map(([restaurantId, items]) => [
            restaurantId,
            (Array.isArray(items) ? items : [])
                .filter((item) => item && typeof item.text === 'string')
                .map((item) => ({
                    id: String(item.id || `cloud-${restaurantId}-${item.createdAt || Date.now()}`),
                    text: item.text.trim().slice(0, SHOP_COMMENT_MAX),
                    createdAt: Number(item.createdAt) || Date.now(),
                }))
                .filter((item) => item.text)
                .slice(0, 8),
        ])
    ) as ShopCommentStore;

const normalizeFreeNotes = (notes?: WowoSeedNote[]) =>
    (Array.isArray(notes) ? notes : [])
        .filter((note) => note && typeof note.shopName === 'string' && typeof note.text === 'string')
        .map((note) => ({
            id: String(note.id || `cloud-free-${note.createdAt || Date.now()}`),
            shopName: note.shopName.trim().slice(0, FREE_NOTE_SHOP_MAX),
            text: note.text.trim().slice(0, FREE_NOTE_TEXT_MAX),
            createdAt: Number(note.createdAt) || Date.now(),
        }))
        .filter((note) => note.shopName && note.text)
        .slice(0, 12);

const mapCommentRow = (row: ShopCommentRow): ShopComment => ({
    id: row.id,
    text: row.text,
    createdAt: Date.parse(row.created_at) || Date.now(),
});

const mapFreeNoteRow = (row: FreeNoteRow): WowoSeedNote => ({
    id: row.id,
    shopName: row.shop_name,
    text: row.text,
    createdAt: Date.parse(row.created_at) || Date.now(),
});

const getSupabaseBootstrap = async () => {
    if (!supabase) return null;

    const [voteCountsResult, commentsResult, freeNotesResult] = await Promise.all([
        supabase.from('vote_counts').select('restaurant_id,vote_count'),
        supabase
            .from('shop_comments')
            .select('id,restaurant_id,text,created_at')
            .order('created_at', { ascending: false })
            .limit(400),
        supabase
            .from('free_notes')
            .select('id,shop_name,text,created_at')
            .order('created_at', { ascending: false })
            .limit(12),
    ]);

    if (voteCountsResult.error) throw voteCountsResult.error;
    if (commentsResult.error) throw commentsResult.error;
    if (freeNotesResult.error) throw freeNotesResult.error;

    const voteCounts = Object.fromEntries(
        ((voteCountsResult.data || []) as VoteCountRow[]).map((row) => [row.restaurant_id, row.vote_count || 0])
    ) as CloudVoteCounts;
    const shopComments = ((commentsResult.data || []) as ShopCommentRow[]).reduce<ShopCommentStore>((store, row) => {
        const current = store[row.restaurant_id] || [];
        if (current.length < 8) {
            store[row.restaurant_id] = [...current, mapCommentRow(row)];
        }
        return store;
    }, {});
    const freeNotes = ((freeNotesResult.data || []) as FreeNoteRow[]).map(mapFreeNoteRow);

    return { voteCounts, votedRestaurantIds: [], shopComments, freeNotes };
};

const getSupabaseVoteCount = async (restaurantId: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('vote_counts')
        .select('restaurant_id,vote_count')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (error) throw error;
    return data ? Number((data as VoteCountRow).vote_count || 0) : 0;
};

const submitSupabaseVote = async (restaurantId: string, deviceId: string) => {
    if (!supabase) return null;

    const { error } = await supabase
        .from('restaurant_votes')
        .insert({ restaurant_id: restaurantId, device_id: deviceId });
    if (error && error.code !== '23505') throw error;
    return getSupabaseVoteCount(restaurantId);
};

const submitSupabaseShopComment = async (restaurantId: string, deviceId: string, text: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('shop_comments')
        .insert({ restaurant_id: restaurantId, device_id: deviceId, text })
        .select('id,restaurant_id,text,created_at')
        .single();

    if (error) throw error;
    return mapCommentRow(data as ShopCommentRow);
};

const submitSupabaseFreeNote = async (deviceId: string, shopName: string, text: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('free_notes')
        .insert({ device_id: deviceId, shop_name: shopName, text })
        .select('id,shop_name,text,created_at')
        .single();

    if (error) throw error;
    return mapFreeNoteRow(data as FreeNoteRow);
};

const getInitialFreeNotes = () => {
    const currentNotes = readStorage<WowoSeedNote[]>(FREE_NOTE_STORAGE_KEY, []);
    if (currentNotes.length > 0) return currentNotes;

    return readStorage<WowoSeedNote[]>(OLD_NOTE_STORAGE_KEY, []);
};

const getVoteExtra = (restaurant: WowoRestaurant, votes: VoteStore, cloudVoteCounts: CloudVoteCounts) =>
    cloudVoteCounts[restaurant.id] ?? (votes[restaurant.id] ? 1 : 0);

const getVoteCount = (restaurant: WowoRestaurant, votes: VoteStore, cloudVoteCounts: CloudVoteCounts = {}) =>
    restaurant.baseVotes + getVoteExtra(restaurant, votes, cloudVoteCounts);

const getRating = (restaurant: WowoRestaurant, votes: VoteStore, cloudVoteCounts: CloudVoteCounts = {}) => {
    const extraVotes = getVoteExtra(restaurant, votes, cloudVoteCounts);
    const totalVotes = restaurant.baseVotes + extraVotes;
    const totalScore = restaurant.baseRating * restaurant.baseVotes + extraVotes * 5;

    return totalVotes > 0 ? totalScore / totalVotes : restaurant.baseRating;
};

const getScoreText = (restaurant: WowoRestaurant, votes: VoteStore, cloudVoteCounts: CloudVoteCounts = {}) =>
    getRating(restaurant, votes, cloudVoteCounts).toFixed(1);

const sortByRating = (restaurants: WowoRestaurant[], votes: VoteStore, cloudVoteCounts: CloudVoteCounts = {}) =>
    [...restaurants].sort((a, b) => {
        const ratingDiff = getRating(b, votes, cloudVoteCounts) - getRating(a, votes, cloudVoteCounts);
        if (ratingDiff !== 0) return ratingDiff;

        const voteDiff = getVoteCount(b, votes, cloudVoteCounts) - getVoteCount(a, votes, cloudVoteCounts);
        if (voteDiff !== 0) return voteDiff;

        return a.rideMinutes - b.rideMinutes;
    });

const sortByRide = (restaurants: WowoRestaurant[]) =>
    [...restaurants].sort((a, b) => a.rideMinutes - b.rideMinutes || a.no.localeCompare(b.no));

const filterRestaurants = (filters: FilterState, restaurants = wowoRestaurants) =>
    sortByRide(
        restaurants.filter((restaurant) => {
            const matchesTime = filters.time === '全部' || restaurant.times.includes(filters.time);
            const matchesScene = filters.scene === '全部' || restaurant.scenes.includes(filters.scene);
            const matchesDistance =
                filters.distance === '全部' || restaurant.rideMinutes <= rideBandMax[filters.distance];

            return matchesTime && matchesScene && matchesDistance;
        })
    );

const truncateText = (text: string, maxLength: number) =>
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

const getMealBadge = (restaurant: WowoRestaurant): MealBadge => {
    if (restaurant.category === '早餐类' || restaurant.times.includes('早餐')) {
        return { label: 'A', title: '早餐' };
    }

    if (
        restaurant.category === '中晚餐' ||
        restaurant.category === '夜宵类' ||
        restaurant.times.some((time) => time === '晚饭' || time === '夜宵')
    ) {
        return { label: 'C', title: '晚餐' };
    }

    return { label: 'B', title: '午餐' };
};

const getShopCommentItems = (restaurant: WowoRestaurant, shopComments: ShopCommentStore): CommentItem[] => [
    ...(shopComments[restaurant.id] || []).map((comment) => ({
        id: comment.id,
        text: comment.text,
    })),
    ...restaurant.seedNotes.map((text, index) => ({
        id: `${restaurant.id}-seed-${index}`,
        text,
    })),
];

const playEnterSound = () => {
    const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    const osc = context.createOscillator();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.2);
};

const WowoFoodAssistant: React.FC = () => {
    const [showAssistant, setShowAssistant] = useState(false);
    const [introLeaving, setIntroLeaving] = useState(false);
    const [toast, setToast] = useState('');

    const enterAssistant = () => {
        playEnterSound();
        setIntroLeaving(true);
        window.setTimeout(() => setShowAssistant(true), 620);
    };

    return (
        <div className="wowo-shell">
            {!showAssistant ? (
                <IntroExperience leaving={introLeaving} onEnter={enterAssistant} />
            ) : (
                <FoodFinder setToast={setToast} />
            )}

            {toast && <div className="wowo-toast">{toast}</div>}
        </div>
    );
};

const IntroExperience: React.FC<{ leaving: boolean; onEnter: () => void }> = ({ leaving, onEnter }) => (
    <section className={`wowo-flat-intro ${leaving ? 'is-leaving' : ''}`}>
        <div className="wowo-flat-stage" aria-label="窝窝吃饭小助手南昌平涂开场">
            <img
                className="wowo-flat-start"
                src={introStartImage}
                width={941}
                height={1672}
                decoding="sync"
                fetchPriority="high"
                alt=""
            />
            <img
                className="wowo-flat-end"
                src={introEndImage}
                width={941}
                height={1672}
                decoding="async"
                fetchPriority="high"
                alt=""
            />
            <div className="wowo-flat-soft-light" aria-hidden />
            <div className="wowo-flat-title">
                <span>窝窝吃饭小助手</span>
                <strong>今天吃什么？</strong>
            </div>
            <div className="wowo-flat-action">
                <Button type="primary" size="large" onClick={onEnter}>
                    开始找吃的
                </Button>
            </div>
        </div>
    </section>
);

const FoodFinder: React.FC<{ setToast: (message: string) => void }> = ({ setToast }) => {
    const [activeScreen, setActiveScreen] = useState<ActiveScreen>('finder');
    const [resultMode, setResultMode] = useState<ResultMode>('filtered');
    const [loadingKind, setLoadingKind] = useState<LoadingKind>('filter');
    const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
    const [randomPick, setRandomPick] = useState<RandomPick | null>(null);
    const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
    const [detailBackTarget, setDetailBackTarget] = useState<DetailBackTarget>('results');
    const [detailFocusComment, setDetailFocusComment] = useState(false);
    const [deviceId] = useState(getOrCreateDeviceId);
    const [votes, setVotes] = useState<VoteStore>(() => readStorage<VoteStore>(VOTE_STORAGE_KEY, {}));
    const [cloudVoteCounts, setCloudVoteCounts] = useState<CloudVoteCounts>({});
    const [freeNotes, setFreeNotes] = useState<WowoSeedNote[]>(getInitialFreeNotes);
    const [shopComments, setShopComments] = useState<ShopCommentStore>(() =>
        readStorage<ShopCommentStore>(SHOP_COMMENT_STORAGE_KEY, {})
    );
    const [freeNoteShopName, setFreeNoteShopName] = useState('');
    const [freeNoteText, setFreeNoteText] = useState('');
    const [shopCommentDrafts, setShopCommentDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        writeStorage(VOTE_STORAGE_KEY, votes);
    }, [votes]);

    useEffect(() => {
        writeStorage(FREE_NOTE_STORAGE_KEY, freeNotes);
    }, [freeNotes]);

    useEffect(() => {
        writeStorage(SHOP_COMMENT_STORAGE_KEY, shopComments);
    }, [shopComments]);

    useEffect(() => {
        let isMounted = true;

        getSupabaseBootstrap()
            .then((data) => {
                if (!isMounted || !data) return;

                const nextVoteCounts = normalizeVoteCounts(data.voteCounts);
                const nextVotedIds = Array.isArray(data.votedRestaurantIds) ? data.votedRestaurantIds : [];
                const nextShopComments = normalizeShopComments(data.shopComments);
                const nextFreeNotes = normalizeFreeNotes(data.freeNotes);

                setCloudVoteCounts(nextVoteCounts);
                if (nextVotedIds.length > 0) {
                    setVotes((current) => ({
                        ...current,
                        ...Object.fromEntries(nextVotedIds.map((restaurantId) => [restaurantId, true])),
                    }));
                }
                if (Object.keys(nextShopComments).length > 0) {
                    setShopComments(nextShopComments);
                }
                if (nextFreeNotes.length > 0) {
                    setFreeNotes(nextFreeNotes);
                }
            })
            .catch(() => {
                // Keep the H5 usable with local browser storage when Supabase is unavailable.
            });

        return () => {
            isMounted = false;
        };
    }, [deviceId]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeScreen]);

    const visibleRestaurants = useMemo(
        () => wowoRestaurants.filter((restaurant) => restaurant.verificationStatus === 'verified'),
        []
    );
    const topRestaurants = useMemo(
        () => sortByRating(visibleRestaurants, votes, cloudVoteCounts).slice(0, 3),
        [visibleRestaurants, votes, cloudVoteCounts]
    );
    const rankingRestaurants = useMemo(
        () => sortByRating(visibleRestaurants, votes, cloudVoteCounts),
        [visibleRestaurants, votes, cloudVoteCounts]
    );
    const draftMatchCount = useMemo(
        () => filterRestaurants(draftFilters, visibleRestaurants).length,
        [draftFilters, visibleRestaurants]
    );
    const resultRestaurants = useMemo(
        () => filterRestaurants(appliedFilters, visibleRestaurants),
        [appliedFilters, visibleRestaurants]
    );
    const selectedRestaurant = useMemo(
        () => visibleRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
        [selectedRestaurantId, visibleRestaurants]
    );

    const displayFreeNotes = freeNotes.length > 0 ? [...freeNotes, ...seedNotes] : seedNotes;

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 1900);
    };

    const handleVote = async (restaurant: WowoRestaurant) => {
        if (votes[restaurant.id]) return;

        setVotes((current) => ({ ...current, [restaurant.id]: true }));
        if (supabase) {
            setCloudVoteCounts((current) => ({
                ...current,
                [restaurant.id]: (current[restaurant.id] || 0) + 1,
            }));
        }
        showToast(`已给 ${restaurant.shortName} 投票`);
        try {
            const voteCount = await submitSupabaseVote(restaurant.id, deviceId);

            if (voteCount !== null) {
                setCloudVoteCounts((current) => ({ ...current, [restaurant.id]: voteCount }));
            }
        } catch {
            // The local vote is kept when Supabase is unavailable.
        }
    };

    const handleNavigate = (restaurant: WowoRestaurant) => {
        const label = encodeURIComponent(restaurant.amapName || restaurant.shortName);
        const poiId = restaurant.amapPoiId;
        const position = restaurant.amapLocation;

        if (poiId) {
            const url = `https://uri.amap.com/marker?poiid=${encodeURIComponent(poiId)}&name=${label}&src=wowo-food-helper&callnative=1`;
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        if (!position) {
            setToast('这家店还在核准高德定位，暂时不能打开。');
            return;
        }

        const url = `https://uri.amap.com/marker?position=${position}&name=${label}&src=wowo-food-helper&coordinate=gaode&callnative=1`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const submitFreeNote = (event: React.FormEvent) => {
        event.preventDefault();

        const shopName = freeNoteShopName.trim();
        const text = freeNoteText.trim();
        if (!shopName || !text) {
            showToast('先写店名和一句话推荐');
            return;
        }

        const nextNote: WowoSeedNote = {
            id: `free-${Date.now()}`,
            shopName: shopName.slice(0, FREE_NOTE_SHOP_MAX),
            text: text.slice(0, FREE_NOTE_TEXT_MAX),
            createdAt: Date.now(),
        };

        setFreeNotes((current) => [nextNote, ...current].slice(0, 12));
        setFreeNoteShopName('');
        setFreeNoteText('');
        submitSupabaseFreeNote(deviceId, nextNote.shopName, nextNote.text)
            .then((note) => {
                if (!note) return;
                setFreeNotes((current) => [note, ...current.filter((item) => item.id !== nextNote.id)].slice(0, 12));
            })
            .catch(() => {
                // Keep the local note visible if Supabase submission fails.
            });
        showToast('推荐已贴上');
    };

    const submitShopComment = (event: React.FormEvent, restaurant: WowoRestaurant) => {
        event.preventDefault();

        const text = (shopCommentDrafts[restaurant.id] || '').trim();
        if (!text) {
            showToast('先写一句对这家店的留言');
            return;
        }

        const nextComment: ShopComment = {
            id: `shop-${restaurant.id}-${Date.now()}`,
            text: text.slice(0, SHOP_COMMENT_MAX),
            createdAt: Date.now(),
        };

        setShopComments((current) => ({
            ...current,
            [restaurant.id]: [nextComment, ...(current[restaurant.id] || [])].slice(0, 8),
        }));
        setShopCommentDrafts((current) => ({ ...current, [restaurant.id]: '' }));
        submitSupabaseShopComment(restaurant.id, deviceId, nextComment.text)
            .then((comment) => {
                if (!comment) return;
                setShopComments((current) => ({
                    ...current,
                    [restaurant.id]: [
                        comment,
                        ...(current[restaurant.id] || []).filter((comment) => comment.id !== nextComment.id),
                    ].slice(0, 8),
                }));
            })
            .catch(() => {
                // Keep the local comment visible if Supabase submission fails.
            });
        showToast(`已贴到 ${restaurant.shortName}`);
    };

    const submitInlineShopComment = (restaurant: WowoRestaurant, rawText: string) => {
        const text = rawText.trim();
        if (!text) {
            showToast('先写一句对这家店的留言');
            return false;
        }

        const nextComment: ShopComment = {
            id: `shop-${restaurant.id}-${Date.now()}`,
            text: text.slice(0, SHOP_COMMENT_MAX),
            createdAt: Date.now(),
        };

        setShopComments((current) => ({
            ...current,
            [restaurant.id]: [nextComment, ...(current[restaurant.id] || [])].slice(0, 8),
        }));
        showToast(`已贴到 ${restaurant.shortName}`);
        submitSupabaseShopComment(restaurant.id, deviceId, nextComment.text)
            .then((comment) => {
                if (!comment) return;
                setShopComments((current) => ({
                    ...current,
                    [restaurant.id]: [
                        comment,
                        ...(current[restaurant.id] || []).filter((comment) => comment.id !== nextComment.id),
                    ].slice(0, 8),
                }));
            })
            .catch(() => {
                // Keep the local comment visible if Supabase submission fails.
            });
        return true;
    };

    const clearFilters = () => {
        setDraftFilters(defaultFilters);
        setRandomPick(null);
    };

    const selectTime = (time: FilterSelection<TimeFilter>) => {
        setDraftFilters((current) => ({ ...current, time }));
        setRandomPick(null);
    };

    const selectScene = (scene: FilterSelection<SceneFilter>) => {
        setDraftFilters((current) => ({ ...current, scene }));
        setRandomPick(null);
    };

    const selectDistance = (distance: FilterSelection<RideBand>) => {
        setDraftFilters((current) => ({ ...current, distance }));
        setRandomPick(null);
    };

    const pickFrom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

    const enterLoading = (kind: LoadingKind, afterLoading: () => void) => {
        setLoadingKind(kind);
        setActiveScreen('loading');
        window.setTimeout(afterLoading, 820);
    };

    const applyFilters = () => {
        setRandomPick(null);
        setResultMode('filtered');
        setAppliedFilters(draftFilters);
        enterLoading('filter', () => setActiveScreen('results'));
    };

    const randomRestaurant = (source: 'draft' | 'applied' = 'draft') => {
        const sourceFilters = source === 'applied' ? appliedFilters : draftFilters;
        const sourceCandidates = filterRestaurants(sourceFilters, visibleRestaurants);
        const candidates = sourceCandidates.length > 0 ? sourceCandidates : sortByRide(visibleRestaurants);
        const restaurant = pickFrom(candidates);
        const helper =
            sourceCandidates.length > 0
                ? source === 'applied'
                    ? '这是从当前筛选结果里抽出来的。'
                    : '这是从你刚刚选的条件里抽出来的。'
                : '这次从全部附近餐馆里随了一家。';

        setAppliedFilters(sourceCandidates.length > 0 ? sourceFilters : defaultFilters);
        setRandomPick({ restaurant, helper });
        setResultMode('random');
        enterLoading('random', () => setActiveScreen('results'));
    };

    const showAllRestaurants = () => {
        setRandomPick(null);
        setAppliedFilters(defaultFilters);
        setResultMode('all');
        enterLoading('all', () => setActiveScreen('results'));
    };

    const openRanking = () => setActiveScreen('ranking');
    const backToFinder = () => setActiveScreen('finder');
    const openDetail = (restaurant: WowoRestaurant, backTarget: DetailBackTarget, focusComment = false) => {
        setSelectedRestaurantId(restaurant.id);
        setDetailBackTarget(backTarget);
        setDetailFocusComment(focusComment);
        setActiveScreen('detail');
    };
    const backFromDetail = () => setActiveScreen(detailBackTarget);

    if (activeScreen === 'ranking') {
        return (
            <RankingScreen
                restaurants={rankingRestaurants}
                votes={votes}
                cloudVoteCounts={cloudVoteCounts}
                freeNotes={displayFreeNotes}
                shopComments={shopComments}
                shopCommentDrafts={shopCommentDrafts}
                freeNoteShopName={freeNoteShopName}
                freeNoteText={freeNoteText}
                onBack={backToFinder}
                onVote={handleVote}
                onNavigate={handleNavigate}
                onShopCommentDraftChange={(restaurantId, value) =>
                    setShopCommentDrafts((current) => ({ ...current, [restaurantId]: value }))
                }
                onSubmitShopComment={submitShopComment}
                onSubmitInlineComment={submitInlineShopComment}
                onOpenDetail={(restaurant) => openDetail(restaurant, 'ranking')}
                onOpenComment={(restaurant) => openDetail(restaurant, 'ranking', true)}
                onFreeNoteShopNameChange={setFreeNoteShopName}
                onFreeNoteTextChange={setFreeNoteText}
                onSubmitFreeNote={submitFreeNote}
            />
        );
    }

    if (activeScreen === 'detail' && selectedRestaurant) {
        return (
            <RestaurantDetailScreen
                restaurant={selectedRestaurant}
                comments={getShopCommentItems(selectedRestaurant, shopComments)}
                draft={shopCommentDrafts[selectedRestaurant.id] || ''}
                score={getScoreText(selectedRestaurant, votes, cloudVoteCounts)}
                voteCount={getVoteCount(selectedRestaurant, votes, cloudVoteCounts)}
                voted={!!votes[selectedRestaurant.id]}
                onBack={backFromDetail}
                onVote={() => handleVote(selectedRestaurant)}
                onNavigate={() => handleNavigate(selectedRestaurant)}
                focusComment={detailFocusComment}
                onDraftChange={(value) =>
                    setShopCommentDrafts((current) => ({ ...current, [selectedRestaurant.id]: value }))
                }
                onSubmit={(event) => submitShopComment(event, selectedRestaurant)}
            />
        );
    }

    if (activeScreen === 'loading') {
        return <LoadingScreen kind={loadingKind} />;
    }

    if (activeScreen === 'results') {
        return (
            <ResultsScreen
                mode={resultMode}
                restaurants={resultMode === 'all' ? sortByRide(visibleRestaurants) : resultRestaurants}
                visibleCount={visibleRestaurants.length}
                randomPick={randomPick}
                votes={votes}
                cloudVoteCounts={cloudVoteCounts}
                shopComments={shopComments}
                onBack={backToFinder}
                onVote={handleVote}
                onNavigate={handleNavigate}
                onOpenRanking={openRanking}
                onOpenDetail={(restaurant) => openDetail(restaurant, 'results')}
                onOpenComment={(restaurant) => openDetail(restaurant, 'results', true)}
                onSubmitInlineComment={submitInlineShopComment}
                onRandom={() => randomRestaurant('applied')}
                onShowAll={showAllRestaurants}
            />
        );
    }

    return (
        <main className="wowo-phone">
            <div className="wowo-status" aria-hidden>
                <span>窝窝青年旅舍</span>
                <span>{visibleRestaurants.length} 家核准餐馆</span>
            </div>

            <section className="wowo-hero">
                <div className="wowo-kicker">
                    <span className="wowo-kicker-icon">
                        <Icon name="icon-map" size={15} />
                    </span>
                    窝窝吃饭小助手
                </div>
                <h1 className="wowo-main-title">今天吃什么？</h1>
                <p className="wowo-subtitle">从窝窝出发，先找最近的，再按饭点和心情筛一下。</p>
            </section>

            <Card className="wowo-card wowo-filter-card" color="app-yellow" pattern="app-yellow">
                <div className="wowo-section-head">
                    <div>
                        <h2>附近餐馆筛选</h2>
                        <p>先选标签，再点选择筛选</p>
                    </div>
                    <div className="wowo-filter-head-actions">
                        <button type="button" className="wowo-clear" onClick={clearFilters}>
                            重置
                        </button>
                    </div>
                </div>

                <FilterGroup label="骑行距离" variant="distance">
                    <FilterChip active={draftFilters.distance === '全部'} onClick={() => selectDistance('全部')}>
                        全部
                    </FilterChip>
                    {rideBands.map((distance) => (
                        <FilterChip
                            key={distance}
                            active={draftFilters.distance === distance}
                            onClick={() => selectDistance(distance)}
                        >
                            {distance}
                        </FilterChip>
                    ))}
                </FilterGroup>

                <FilterGroup label="饭点功能" variant="time">
                    <FilterChip active={draftFilters.time === '全部'} onClick={() => selectTime('全部')}>
                        全部
                    </FilterChip>
                    {timeFilters.map((time) => (
                        <FilterChip key={time} active={draftFilters.time === time} onClick={() => selectTime(time)}>
                            {time}
                        </FilterChip>
                    ))}
                </FilterGroup>

                <FilterGroup label="用餐场景" variant="scene">
                    <FilterChip active={draftFilters.scene === '全部'} onClick={() => selectScene('全部')}>
                        全部
                    </FilterChip>
                    {sceneFilters.map((scene) => (
                        <FilterChip
                            key={scene}
                            active={draftFilters.scene === scene}
                            onClick={() => selectScene(scene)}
                        >
                            {scene}
                        </FilterChip>
                    ))}
                </FilterGroup>

                <div className="wowo-filter-actions">
                    <Button type="primary" size="large" onClick={applyFilters}>
                        选择筛选
                    </Button>
                    <span>当前条件约 {draftMatchCount} 家可能符合</span>
                </div>
            </Card>

            <TopRatedPanel
                restaurants={topRestaurants}
                votes={votes}
                cloudVoteCounts={cloudVoteCounts}
                onShowRanking={openRanking}
            />

            <RandomActionPanel onRandom={() => randomRestaurant('draft')} />

            <FreeNoteBoard
                title="大家随口推荐"
                description="哪家好吃都可以贴一张小纸条，给下一个住户一点灵感。"
                notes={displayFreeNotes}
                shopName={freeNoteShopName}
                text={freeNoteText}
                onShopNameChange={setFreeNoteShopName}
                onTextChange={setFreeNoteText}
                onSubmit={submitFreeNote}
            />

            <Card className="wowo-card wowo-all-restaurants-card">
                <div>
                    <strong>想慢慢看完整名单？</strong>
                    <span>打开 47 家核准餐馆，按骑行时间从近到远浏览。</span>
                </div>
                <Button type="default" onClick={showAllRestaurants}>
                    查看所有餐馆
                </Button>
            </Card>

            <p className="wowo-note">营业时间可能调整，出发前建议先打开高德确认。投票和留言仅保存在当前浏览器。</p>
        </main>
    );
};

const LoadingScreen: React.FC<{ kind: LoadingKind }> = ({ kind }) => {
    const copy = loadingCopy[kind];

    return (
        <main className="wowo-phone wowo-loading-page" aria-live="polite">
            <div className="wowo-loading-card">
                <div className="wowo-loading-bowl" aria-hidden>
                    <span />
                    <span />
                    <span />
                </div>
                <h1>{copy.title}</h1>
                <p>{copy.body}</p>
            </div>
        </main>
    );
};

const ResultsScreen: React.FC<{
    mode: ResultMode;
    restaurants: WowoRestaurant[];
    visibleCount: number;
    randomPick: RandomPick | null;
    votes: VoteStore;
    cloudVoteCounts: CloudVoteCounts;
    shopComments: ShopCommentStore;
    onBack: () => void;
    onVote: (restaurant: WowoRestaurant) => void;
    onNavigate: (restaurant: WowoRestaurant) => void;
    onOpenRanking: () => void;
    onOpenDetail: (restaurant: WowoRestaurant) => void;
    onOpenComment: (restaurant: WowoRestaurant) => void;
    onSubmitInlineComment: (restaurant: WowoRestaurant, text: string) => boolean;
    onRandom: () => void;
    onShowAll: () => void;
}> = ({
    mode,
    restaurants,
    visibleCount,
    randomPick,
    votes,
    cloudVoteCounts,
    shopComments,
    onBack,
    onVote,
    onNavigate,
    onOpenRanking,
    onOpenDetail,
    onOpenComment,
    onSubmitInlineComment,
    onRandom,
    onShowAll,
}) => {
    const commentPreviewCount = mode === 'random' || restaurants.length === 1 ? 3 : 2;

    return (
        <main className="wowo-phone">
            <div className="wowo-status" aria-hidden>
                <span>窝窝青年旅舍</span>
                <span>{mode === 'all' ? '全部名单' : mode === 'random' ? '随机结果' : '筛选结果'}</span>
            </div>

            <section className="wowo-results-hero">
                <button type="button" className="wowo-back-button" onClick={onBack}>
                    <span aria-hidden>‹</span>
                    {mode === 'random' ? '返回筛选' : '重新筛选'}
                </button>
                <button type="button" className="wowo-clear wowo-view-toggle" onClick={onOpenRanking}>
                    看高分榜
                </button>
            </section>

            <section aria-live="polite">
                <div className="wowo-results-head">
                    <h2>{mode === 'all' ? '所有餐馆' : mode === 'random' ? '随机结果' : '筛选结果'}</h2>
                    <span>{mode === 'random' ? '1 家' : `${restaurants.length} / ${visibleCount} 家`}</span>
                </div>

                {mode === 'random' && randomPick && (
                    <RandomPickCard
                        pick={randomPick}
                        score={getScoreText(randomPick.restaurant, votes, cloudVoteCounts)}
                        voteCount={getVoteCount(randomPick.restaurant, votes, cloudVoteCounts)}
                        voted={!!votes[randomPick.restaurant.id]}
                        comments={getShopCommentItems(randomPick.restaurant, shopComments)}
                        onVote={() => onVote(randomPick.restaurant)}
                        onNavigate={() => onNavigate(randomPick.restaurant)}
                        onOpenDetail={() => onOpenDetail(randomPick.restaurant)}
                        onOpenComment={() => onOpenComment(randomPick.restaurant)}
                        onSubmitInlineComment={(text) => onSubmitInlineComment(randomPick.restaurant, text)}
                    />
                )}

                {mode !== 'random' && restaurants.length > 0 ? (
                    <div className="wowo-list">
                        {restaurants.map((restaurant) => (
                            <RestaurantCard
                                key={restaurant.id}
                                restaurant={restaurant}
                                score={getScoreText(restaurant, votes, cloudVoteCounts)}
                                voteCount={getVoteCount(restaurant, votes, cloudVoteCounts)}
                                voted={!!votes[restaurant.id]}
                                comments={getShopCommentItems(restaurant, shopComments)}
                                commentPreviewCount={commentPreviewCount}
                                onVote={() => onVote(restaurant)}
                                onNavigate={() => onNavigate(restaurant)}
                                onOpenDetail={() => onOpenDetail(restaurant)}
                                onOpenComment={() => onOpenComment(restaurant)}
                                onSubmitInlineComment={(text) => onSubmitInlineComment(restaurant, text)}
                            />
                        ))}
                    </div>
                ) : null}

                {mode !== 'random' && restaurants.length === 0 ? (
                    <Card className="wowo-card wowo-empty">
                        <strong>这组条件暂时没有匹配</strong>
                        <p>可以回去放宽距离，或者把场景切回全部看看。</p>
                        <Button type="primary" onClick={onBack}>
                            重新筛选
                        </Button>
                    </Card>
                ) : null}

                {mode === 'filtered' && (
                    <ResultActionPanel
                        primaryLabel="随机筛选"
                        secondaryLabel="查看所有餐馆"
                        helper="随机只抽一家；所有餐馆可慢慢看完整名单。"
                        onPrimary={onRandom}
                        onSecondary={onShowAll}
                    />
                )}

                {mode === 'random' && (
                    <ResultActionPanel
                        primaryLabel="重抽一次"
                        secondaryLabel="查看所有名单餐馆"
                        helper="点重抽会重新进入抽签流程；想完整浏览可以打开全部名单。"
                        onPrimary={onRandom}
                        onSecondary={onShowAll}
                    />
                )}

                {mode === 'all' && (
                    <div className="wowo-single-result-action">
                        <Button type="primary" onClick={onBack}>
                            重新筛选
                        </Button>
                    </div>
                )}
            </section>

            <p className="wowo-note">营业时间可能调整，出发前建议先打开高德确认。</p>
        </main>
    );
};

const ResultActionPanel: React.FC<{
    primaryLabel: string;
    secondaryLabel: string;
    helper: string;
    onPrimary: () => void;
    onSecondary: () => void;
}> = ({ primaryLabel, secondaryLabel, helper, onPrimary, onSecondary }) => (
    <Card className="wowo-card wowo-result-actions-card">
        <div className="wowo-result-actions-grid">
            <Button type="primary" onClick={onPrimary}>
                {primaryLabel}
            </Button>
            <Button type="default" onClick={onSecondary}>
                {secondaryLabel}
            </Button>
        </div>
        <p>{helper}</p>
    </Card>
);

const RankingScreen: React.FC<{
    restaurants: WowoRestaurant[];
    votes: VoteStore;
    cloudVoteCounts: CloudVoteCounts;
    freeNotes: WowoSeedNote[];
    shopComments: ShopCommentStore;
    shopCommentDrafts: Record<string, string>;
    freeNoteShopName: string;
    freeNoteText: string;
    onBack: () => void;
    onVote: (restaurant: WowoRestaurant) => void;
    onNavigate: (restaurant: WowoRestaurant) => void;
    onShopCommentDraftChange: (restaurantId: string, value: string) => void;
    onSubmitShopComment: (event: React.FormEvent, restaurant: WowoRestaurant) => void;
    onSubmitInlineComment: (restaurant: WowoRestaurant, text: string) => boolean;
    onOpenDetail: (restaurant: WowoRestaurant) => void;
    onOpenComment: (restaurant: WowoRestaurant) => void;
    onFreeNoteShopNameChange: (value: string) => void;
    onFreeNoteTextChange: (value: string) => void;
    onSubmitFreeNote: (event: React.FormEvent) => void;
}> = ({
    restaurants,
    votes,
    cloudVoteCounts,
    freeNotes,
    shopComments,
    shopCommentDrafts,
    freeNoteShopName,
    freeNoteText,
    onBack,
    onVote,
    onNavigate,
    onShopCommentDraftChange,
    onSubmitShopComment,
    onSubmitInlineComment,
    onOpenDetail,
    onOpenComment,
    onFreeNoteShopNameChange,
    onFreeNoteTextChange,
    onSubmitFreeNote,
}) => (
    <main className="wowo-phone wowo-ranking-page">
        <div className="wowo-status" aria-hidden>
            <span>窝窝青年旅舍</span>
            <span>住户口碑榜</span>
        </div>

        <section className="wowo-ranking-hero">
            <button type="button" className="wowo-back-button" onClick={onBack}>
                <span aria-hidden>‹</span>
                返回筛选
            </button>
            <h1 className="wowo-main-title">高分餐馆榜</h1>
            <p className="wowo-subtitle">按住户投票、基础评分和骑行时间综合排序。想夸哪家，就直接贴到店铺下面。</p>
        </section>

        <FreeNoteBoard
            title="畅所欲言"
            description="推荐哪家都可以，适合放不进单店评论的小纸条。"
            notes={freeNotes}
            shopName={freeNoteShopName}
            text={freeNoteText}
            onShopNameChange={onFreeNoteShopNameChange}
            onTextChange={onFreeNoteTextChange}
            onSubmit={onSubmitFreeNote}
        />

        <section aria-live="polite">
            <div className="wowo-results-head">
                <h2>完整排名</h2>
                <span>{restaurants.length} 家</span>
            </div>

            <div className="wowo-list">
                {restaurants.map((restaurant, index) => (
                    <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        rank={index + 1}
                        score={getScoreText(restaurant, votes, cloudVoteCounts)}
                        voteCount={getVoteCount(restaurant, votes, cloudVoteCounts)}
                        voted={!!votes[restaurant.id]}
                        onVote={() => onVote(restaurant)}
                        onNavigate={() => onNavigate(restaurant)}
                        onOpenDetail={() => onOpenDetail(restaurant)}
                        onOpenComment={() => onOpenComment(restaurant)}
                        onSubmitInlineComment={(text) => onSubmitInlineComment(restaurant, text)}
                    >
                        <ShopCommentPanel
                            restaurant={restaurant}
                            comments={getShopCommentItems(restaurant, shopComments)}
                            draft={shopCommentDrafts[restaurant.id] || ''}
                            onDraftChange={(value) => onShopCommentDraftChange(restaurant.id, value)}
                            onSubmit={(event) => onSubmitShopComment(event, restaurant)}
                            onOpenDetail={() => onOpenDetail(restaurant)}
                        />
                    </RestaurantCard>
                ))}
            </div>
        </section>

        <p className="wowo-note">榜单会随当前浏览器里的投票变化。真实营业时间可能调整，出发前建议先打开高德确认。</p>
    </main>
);

const RestaurantDetailScreen: React.FC<{
    restaurant: WowoRestaurant;
    comments: CommentItem[];
    draft: string;
    score: string;
    voteCount: number;
    voted: boolean;
    focusComment: boolean;
    onBack: () => void;
    onVote: () => void;
    onNavigate: () => void;
    onDraftChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
}> = ({
    restaurant,
    comments,
    draft,
    score,
    voteCount,
    voted,
    focusComment,
    onBack,
    onVote,
    onNavigate,
    onDraftChange,
    onSubmit,
}) => {
    const commentInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!focusComment) return;

        const timer = window.setTimeout(() => {
            commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            commentInputRef.current?.focus();
        }, 160);

        return () => window.clearTimeout(timer);
    }, [focusComment, restaurant.id]);

    return (
        <main className="wowo-phone wowo-detail-page">
            <div className="wowo-status" aria-hidden>
                <span>窝窝青年旅舍</span>
                <span>餐馆详情</span>
            </div>

            <section className="wowo-ranking-hero">
                <button type="button" className="wowo-back-button" onClick={onBack}>
                    <span aria-hidden>‹</span>
                    返回
                </button>
                <h1 className="wowo-main-title">{restaurant.shortName}</h1>
                <p className="wowo-subtitle">
                    骑行 {restaurant.rideMinutes} 分钟 · {score} 分 · {voteCount} 票
                </p>
            </section>

            <RestaurantCard
                restaurant={restaurant}
                score={score}
                voteCount={voteCount}
                voted={voted}
                onVote={onVote}
                onNavigate={onNavigate}
            />

            <Card className={`wowo-card wowo-detail-comments ${focusComment ? 'is-comment-focus' : ''}`}>
                <div className="wowo-section-head">
                    <div>
                        <h2>这家店的完整留言</h2>
                        <p>短一点更好读，最多 {SHOP_COMMENT_MAX} 字。</p>
                    </div>
                </div>
                <ShopCommentPanel
                    restaurant={restaurant}
                    comments={comments}
                    draft={draft}
                    inputRef={commentInputRef}
                    onDraftChange={onDraftChange}
                    onSubmit={onSubmit}
                />
            </Card>

            <p className="wowo-note">留言只保存在当前浏览器；出发前建议再打开高德确认营业状态。</p>
        </main>
    );
};

const TopRatedPanel: React.FC<{
    restaurants: WowoRestaurant[];
    votes: VoteStore;
    cloudVoteCounts: CloudVoteCounts;
    onShowRanking: () => void;
}> = ({ restaurants, votes, cloudVoteCounts, onShowRanking }) => (
    <Card className="wowo-card wowo-top-panel">
        <div className="wowo-section-head">
            <div>
                <h2>今日高分餐馆</h2>
                <p>先看看大家投出来的前 3 家</p>
            </div>
            <button type="button" className="wowo-clear wowo-view-toggle" onClick={onShowRanking}>
                看高分榜
            </button>
        </div>

        <div className="wowo-top-list">
            {restaurants.map((restaurant, index) => (
                <button key={restaurant.id} type="button" className="wowo-top-item" onClick={onShowRanking}>
                    <span className={`wowo-top-rank wowo-top-rank-${index + 1}`}>TOP {index + 1}</span>
                    <strong>{restaurant.shortName}</strong>
                    <span>
                        {getScoreText(restaurant, votes, cloudVoteCounts)} 分 · 骑行 {restaurant.rideMinutes} 分钟
                    </span>
                </button>
            ))}
        </div>
    </Card>
);

const FilterGroup: React.FC<{ label: string; variant: 'distance' | 'time' | 'scene'; children: React.ReactNode }> = ({
    label,
    variant,
    children,
}) => (
    <div className={`wowo-filter-group wowo-filter-group-${variant}`}>
        <div className="wowo-filter-label">
            <span>{label}</span>
        </div>
        <div className="wowo-chip-grid">{children}</div>
    </div>
);

const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
    active,
    onClick,
    children,
}) => (
    <button type="button" className={`wowo-chip ${active ? 'is-active' : ''}`} onClick={onClick}>
        {children}
    </button>
);

const RandomActionPanel: React.FC<{ onRandom: () => void }> = ({ onRandom }) => (
    <Card className="wowo-card wowo-random-action-card">
        <div className="wowo-section-head">
            <div>
                <h2>不想选了？</h2>
                <p>点一下，让窝窝帮你抽一家今天的签名菜馆。</p>
            </div>
            <button type="button" className="wowo-random-primary" onClick={onRandom}>
                随机吃一家
            </button>
        </div>
    </Card>
);

const RandomPickCard: React.FC<{
    pick: RandomPick;
    score: string;
    voteCount: number;
    voted: boolean;
    comments: CommentItem[];
    onVote: () => void;
    onNavigate: () => void;
    onOpenDetail: () => void;
    onOpenComment: () => void;
    onSubmitInlineComment: (text: string) => boolean;
}> = ({
    pick,
    score,
    voteCount,
    voted,
    comments,
    onVote,
    onNavigate,
    onOpenDetail,
    onOpenComment,
    onSubmitInlineComment,
}) => (
    <div className="wowo-random-pick">
        <div className="wowo-random-pick-copy">
            <span>随机签名</span>
            <strong>今天的签名菜馆就是这一家了</strong>
            <p>{pick.helper}</p>
        </div>
        <RestaurantCard
            restaurant={pick.restaurant}
            score={score}
            voteCount={voteCount}
            voted={voted}
            comments={comments}
            commentPreviewCount={3}
            onVote={onVote}
            onNavigate={onNavigate}
            onOpenDetail={onOpenDetail}
            onOpenComment={onOpenComment}
            onSubmitInlineComment={onSubmitInlineComment}
        />
    </div>
);

const FreeNoteBoard: React.FC<{
    title: string;
    description: string;
    notes: WowoSeedNote[];
    shopName: string;
    text: string;
    onShopNameChange: (value: string) => void;
    onTextChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
}> = ({ title, description, notes, shopName, text, onShopNameChange, onTextChange, onSubmit }) => (
    <Card className="wowo-card wowo-message-board">
        <div className="wowo-section-head">
            <div>
                <h2>{title}</h2>
                <p>{description}</p>
            </div>
        </div>

        <div className="wowo-note-carousel" aria-label="餐馆留言便利贴">
            <div className="wowo-note-track">
                {[...notes, ...notes].map((note, index) => (
                    <div key={`${note.id}-${index}`} className="wowo-sticky-note">
                        <strong>{note.shopName}</strong>
                        <span>{note.text}</span>
                    </div>
                ))}
            </div>
        </div>

        <form className="wowo-note-form" onSubmit={onSubmit}>
            <input
                value={shopName}
                maxLength={FREE_NOTE_SHOP_MAX}
                onChange={(event) => onShopNameChange(event.target.value)}
                placeholder="餐馆名"
                aria-label="餐馆名"
            />
            <input
                value={text}
                maxLength={FREE_NOTE_TEXT_MAX}
                onChange={(event) => onTextChange(event.target.value)}
                placeholder="一句话推荐"
                aria-label="一句话推荐"
            />
            <Button type="primary" htmlType="submit">
                贴上
            </Button>
        </form>
    </Card>
);

const RestaurantCard: React.FC<{
    restaurant: WowoRestaurant;
    rank?: number;
    score: string;
    voteCount: number;
    voted: boolean;
    comments?: CommentItem[];
    commentPreviewCount?: number;
    onVote: () => void;
    onNavigate: () => void;
    onOpenDetail?: () => void;
    onOpenComment?: () => void;
    onSubmitInlineComment?: (text: string) => boolean;
    children?: React.ReactNode;
}> = ({
    restaurant,
    score,
    voteCount,
    voted,
    comments = [],
    commentPreviewCount = 2,
    onVote,
    onNavigate,
    onOpenDetail,
    onSubmitInlineComment,
    children,
}) => {
    const mealBadge = getMealBadge(restaurant);
    const [commentOpen, setCommentOpen] = useState(false);
    const [inlineComment, setInlineComment] = useState('');
    const [spinIcon, setSpinIcon] = useState(false);
    const inlineCommentRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!commentOpen) return;

        const timer = window.setTimeout(() => {
            inlineCommentRef.current?.focus();
            inlineCommentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 90);

        return () => window.clearTimeout(timer);
    }, [commentOpen]);

    const startInlineComment = () => {
        if (!onSubmitInlineComment) return;
        setCommentOpen(true);
    };

    const submitInlineComment = (event: React.FormEvent) => {
        event.preventDefault();
        if (!onSubmitInlineComment) return;

        const saved = onSubmitInlineComment(inlineComment);
        if (saved) {
            setInlineComment('');
            setCommentOpen(false);
        }
    };

    const spinTopIcon = () => {
        setSpinIcon(false);
        window.setTimeout(() => {
            setSpinIcon(true);
            window.setTimeout(() => setSpinIcon(false), 680);
        }, 0);
    };
    const actionClassName = `wowo-card-actions${onSubmitInlineComment ? '' : ' wowo-card-actions-single'}`;

    return (
        <Card className="wowo-card wowo-shop-card">
            <div className="wowo-shop-top">
                <span className={`wowo-number wowo-number-${mealBadge.label.toLowerCase()}`} title={mealBadge.title}>
                    {mealBadge.label}
                </span>
                <div>
                    <h3 className="wowo-shop-name">{restaurant.shortName}</h3>
                    <div className="wowo-shop-meta">
                        <span>
                            <Icon name="icon-map" size={14} />
                            骑行 {restaurant.rideMinutes} 分钟
                        </span>
                        <span>人均待补</span>
                        <span>{score} 分</span>
                        <span>{voteCount} 票</span>
                    </div>
                </div>
                <button
                    type="button"
                    className={`wowo-spin-icon-button ${spinIcon ? 'is-spinning' : ''}`}
                    onClick={spinTopIcon}
                    aria-label="转一下"
                    title="转一下"
                >
                    <Icon name="icon-variant" size={27} className="wowo-spin-icon" />
                </button>
            </div>

            <div className="wowo-shop-scenes">
                <Tag size="small" variant="outlined" color="app-blue">
                    {restaurant.rideBand}
                </Tag>
                {restaurant.scenes.slice(0, 3).map((scene) => (
                    <Tag key={scene} size="small" variant="outlined" color="app-blue">
                        {scene}
                    </Tag>
                ))}
            </div>

            <div className="wowo-dishes">
                <Tag size="small" color="app-orange">
                    招牌 {restaurant.dish}
                </Tag>
                {restaurant.times.slice(0, 2).map((time) => (
                    <Tag key={time} size="small" color="app-yellow">
                        {time}
                    </Tag>
                ))}
            </div>

            <p className="wowo-reason">{restaurant.seedNotes[0]}</p>

            <div className="wowo-shop-address">
                <span>地址</span>
                <strong>{restaurant.amapAddress || restaurant.address}</strong>
            </div>

            {comments.length > 0 && onOpenDetail && (
                <ShopCommentPreview comments={comments} count={commentPreviewCount} onOpenDetail={onOpenDetail} />
            )}

            <div className={actionClassName}>
                <Button
                    className="wowo-vote-action"
                    type={voted ? 'default' : 'primary'}
                    onClick={onVote}
                    disabled={voted}
                >
                    {voted ? '已投' : '投一票'}
                </Button>
                {onSubmitInlineComment && (
                    <Button className="wowo-comment-action" type="default" onClick={startInlineComment}>
                        留个言
                    </Button>
                )}
                <Button
                    className="wowo-location-action"
                    type="primary"
                    onClick={onNavigate}
                    icon={<img src={amapIcon} width={16} height={16} className="wowo-amap-icon" alt="" />}
                >
                    查看店铺位置
                </Button>
            </div>

            {commentOpen && (
                <form className="wowo-inline-comment-form" onSubmit={submitInlineComment}>
                    <input
                        ref={inlineCommentRef}
                        value={inlineComment}
                        maxLength={SHOP_COMMENT_MAX}
                        onChange={(event) => setInlineComment(event.target.value)}
                        placeholder={`给 ${restaurant.shortName} 留一句`}
                        aria-label={`给 ${restaurant.shortName} 留一句`}
                    />
                    <Button type="primary" htmlType="submit">
                        发出
                    </Button>
                </form>
            )}

            {children}
        </Card>
    );
};

const ShopCommentPreview: React.FC<{
    comments: CommentItem[];
    count: number;
    onOpenDetail: () => void;
}> = ({ comments, count, onOpenDetail }) => {
    const visibleComments = comments.slice(0, Math.min(6, Math.max(5, count)));
    const tickerBase =
        visibleComments.length > 0
            ? Array.from(
                  { length: Math.max(6, visibleComments.length) },
                  (_, index) => visibleComments[index % visibleComments.length]
              )
            : [];
    const tickerComments = [...tickerBase, ...tickerBase];

    return (
        <div className="wowo-comment-preview">
            <div className="wowo-comment-preview-head">
                <span>住户短评播报</span>
                <button type="button" onClick={onOpenDetail}>
                    看全部留言
                </button>
            </div>
            <div className="wowo-comment-preview-list">
                <div className="wowo-comment-preview-track">
                    {tickerComments.map((comment, index) => (
                        <p
                            key={`${comment.id}-${index}`}
                            className={`wowo-comment-line wowo-comment-line-${index % 3}`}
                            style={{ '--line-delay': `${(index % 6) * 0.28}s` } as React.CSSProperties}
                        >
                            <span>{truncateText(comment.text, COMMENT_PREVIEW_MAX)}</span>
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ShopCommentPanel: React.FC<{
    restaurant: WowoRestaurant;
    comments: CommentItem[];
    draft: string;
    inputRef?: React.RefObject<HTMLInputElement>;
    onDraftChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    onOpenDetail?: () => void;
}> = ({ restaurant, comments, draft, inputRef, onDraftChange, onSubmit, onOpenDetail }) => {
    return (
        <div className="wowo-shop-comments">
            <div className="wowo-shop-comments-title">住户留言</div>
            <div className="wowo-shop-comment-list">
                {comments.map((comment) => (
                    <p key={comment.id}>{comment.text}</p>
                ))}
            </div>
            {onOpenDetail && (
                <button type="button" className="wowo-comment-detail-link" onClick={onOpenDetail}>
                    去详情页看全貌
                </button>
            )}
            <form className="wowo-shop-comment-form" onSubmit={onSubmit}>
                <input
                    ref={inputRef}
                    value={draft}
                    maxLength={SHOP_COMMENT_MAX}
                    onChange={(event) => onDraftChange(event.target.value)}
                    placeholder={`给 ${restaurant.shortName} 留一句`}
                    aria-label={`给 ${restaurant.shortName} 留一句`}
                />
                <Button type="primary" htmlType="submit">
                    留言
                </Button>
            </form>
        </div>
    );
};

export default WowoFoodAssistant;
