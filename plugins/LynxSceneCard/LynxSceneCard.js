"use strict";
(function () {
    const PluginApi = window.PluginApi;
    if (window.__lynxSceneCardLoaded) return;
    if (!PluginApi?.React || !PluginApi?.ReactDOM || !PluginApi?.patch?.instead ||
        !PluginApi?.libraries?.Bootstrap || !PluginApi?.libraries?.ReactRouterDOM ||
        !PluginApi?.libraries?.Intl) {
        console.error('[Lynx Scene Card] Required Stash Plugin API components are unavailable. Reload the page after enabling the plugin.');
        return;
    }
    const React = PluginApi.React;
    const ReactDOM = PluginApi.ReactDOM;
    const { useState, useEffect, useRef, createContext, useContext } = React;
    const { patch } = PluginApi;
    const { Overlay, Popover, PopoverContent } = PluginApi.libraries.Bootstrap;
    const { Link } = PluginApi.libraries.ReactRouterDOM;
    const { FormattedDate } = PluginApi.libraries.Intl;
    // Share identical in-flight requests across cards; cap hover caches.
    const requestCache = new Map();
    const CACHE_LIMIT = 64;
    function cachedGraphQL(query, variables = {}) {
        const key = JSON.stringify([query, variables]);
        const now = Date.now();
        const existing = requestCache.get(key);
        if (existing && (existing.pending || existing.expires > now)) return existing.promise;
        requestCache.delete(key);
        const entry = { pending: true, expires: now + 30000 };
        entry.promise = fetch(`${window.location.origin}/graphql`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({query, variables})
        }).then(async response => {
            const result = await response.json();
            if (!response.ok || result.errors?.length) throw new Error(result.errors?.map(e => e.message).join('; ') || 'GraphQL request failed');
            entry.pending = false;
            entry.expires = Date.now() + 30000;
            return result;
        }).catch(error => {
            entry.pending = false;
            entry.expires = Date.now() + 3000;
            throw error;
        });
        requestCache.set(key, entry);
        while (requestCache.size > CACHE_LIMIT) requestCache.delete(requestCache.keys().next().value);
        return entry.promise;
    }
    let appliedCSS = null;
    function applyConfigStyles(config) {
        const selectors = {
            showStudioOverlay: '.scene-card .studio-overlay',
            showSceneSpecsOverlay: '.scene-card .scene-specs-overlay',
            showSceneInteractiveSpeedOverlay: '.scene-card .scene-interactive-speed-overlay',
            showProgressBar: '.scene-card .progress-bar', showHoverScrubber: '.scene-card .hover-scrubber',
            showHoverScrubberIndicator: '.scene-card .hover-scrubber-indicator'
        };
        const css = Object.entries(selectors).filter(([key]) => config[key]).map(([,selector]) => `${selector} { display: block !important; }`).join('');
        if (css === appliedCSS) return;
        let node = document.getElementById('lynx-scene-card-overrides');
        if (!node) { node = document.createElement('style'); node.id = 'lynx-scene-card-overrides'; document.head.appendChild(node); }
        node.textContent = css;
        appliedCSS = css;
    }
    // 1. Define GraphQL Queries
    const FIND_PERFORMER_QUERY = `
      query FindPerformerScenes($id: ID!) {
        findScenes(scene_filter: {performers: {value: [$id], modifier: INCLUDES}}
          filter: {per_page: 3, sort: "title", direction: ASC}) {
          scenes { id title rating100 paths { screenshot stream } }
        }
      }
    `;
    const FIND_TAG_SCENES_QUERY = `
    query FindScenes($tag_id: [ID!]!) {
      findScenes(
        scene_filter: { tags: { value: $tag_id, modifier: INCLUDES } }
        filter: { per_page: 2, sort: "title", direction: ASC }
      ) {
        scenes {
          id
          title
          rating100
          paths {
            screenshot
            stream
          }
          files {
            height
          }
        }
      }
    }
  `;
    const DEFAULT_CONFIG = {
        enablePerformerList: false,
        enableTagChips: false,
        enableFooter: false,
        // New Configuration Defaults
        showStudioOverlay: false,
        showSceneSpecsOverlay: false,
        showSceneInteractiveSpeedOverlay: false,
        showProgressBar: false,
        showHoverScrubber: false,
        showHoverScrubberIndicator: false,
    };
    // 3. Create Context for Configuration
    const SceneCardConfigContext = createContext(DEFAULT_CONFIG);
    // 4. Provider Component to Fetch and Provide Configuration
    const SceneCardConfigProvider = ({ children, }) => {
        const [config, setConfig] = useState(DEFAULT_CONFIG);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        useEffect(() => {
            let isMounted = true;
            const FETCH_CONFIG_QUERY = `
        query Configuration {
          configuration {
            plugins
          }
        }
      `;
            const fetchConfig = async () => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                try {
                    const result = await cachedGraphQL(FETCH_CONFIG_QUERY);
                    if (!isMounted)
                        return;
                    const plugins = ((_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.configuration) === null || _b === void 0 ? void 0 : _b.plugins) || {};
                    const sceneCardPluginConfig = plugins['LynxSceneCard'] || {};
                    // Map configuration fields to match SceneCardConfig interface
                    const mappedConfig = {
                        enablePerformerList: (_c = sceneCardPluginConfig['EnablePerformerList']) !== null && _c !== void 0 ? _c : DEFAULT_CONFIG.enablePerformerList,
                        enableTagChips: (_d = sceneCardPluginConfig['EnableTagChips']) !== null && _d !== void 0 ? _d : DEFAULT_CONFIG.enableTagChips,
                        enableFooter: (_f = sceneCardPluginConfig['EnableFooter']) !== null && _f !== void 0 ? _f : DEFAULT_CONFIG.enableFooter,
                        // Map new configuration fields
                        showStudioOverlay: (_g = sceneCardPluginConfig['ShowStudioOverlay']) !== null && _g !== void 0 ? _g : DEFAULT_CONFIG.showStudioOverlay,
                        showSceneSpecsOverlay: (_h = sceneCardPluginConfig['ShowSceneSpecsOverlay']) !== null && _h !== void 0 ? _h : DEFAULT_CONFIG.showSceneSpecsOverlay,
                        showSceneInteractiveSpeedOverlay: (_j = sceneCardPluginConfig['ShowSceneInteractiveSpeedOverlay']) !== null && _j !== void 0 ? _j : DEFAULT_CONFIG.showSceneInteractiveSpeedOverlay,
                        showProgressBar: (_k = sceneCardPluginConfig['ShowProgressBar']) !== null && _k !== void 0 ? _k : DEFAULT_CONFIG.showProgressBar,
                        showHoverScrubber: (_l = sceneCardPluginConfig['ShowHoverScrubber']) !== null && _l !== void 0 ? _l : DEFAULT_CONFIG.showHoverScrubber,
                        showHoverScrubberIndicator: (_m = sceneCardPluginConfig['ShowHoverScrubberIndicator']) !== null && _m !== void 0 ? _m : DEFAULT_CONFIG.showHoverScrubberIndicator,
                    };
                    applyConfigStyles(mappedConfig);
                    setConfig({
                        ...DEFAULT_CONFIG,
                        ...mappedConfig,
                    });
                    setLoading(false);
                }
                catch (err) {
                    console.error('Error fetching SceneCard configuration:', err);
                    if (isMounted) {
                        setError('Failed to load configuration.');
                        setLoading(false);
                    }
                }
            };
            fetchConfig();
            return () => {
                isMounted = false;
            };
        }, []);
        if (loading) {
            // Optionally, render a loader or nothing while loading
            return null;
        }
        if (error) {
            // Optionally, render an error message or fallback UI
            return null;
        }
        return (React.createElement(SceneCardConfigContext.Provider, { value: config }, children));
    };
    // 5. Custom Hook to Access Configuration
    const useSceneCardConfig = () => useContext(SceneCardConfigContext);
    const Footer = ({ date, views, studio }) => {
        return (React.createElement("div", { className: "footer" },
            React.createElement("span", { className: "studio" }, studio && (React.createElement(Link, { to: `/studios/${studio.id}`, onMouseDown: (e) => e.stopPropagation() }, studio.name))),
            React.createElement("span", { className: "views" },
                views || 0,
                " ",
                views === 1 ? 'view' : 'views'),
            React.createElement("span", { className: "date" }, date && React.createElement(FormattedDate, { value: date, format: "short", timeZone: "utc" }))));
    };
    const SceneItem = ({ scene }) => {
        var _a, _b;
        const [isHovered, setIsHovered] = useState(false);
        const videoRef = useRef(null);
        const handleMouseEnter = () => {
            setIsHovered(true);
        };
        const handleMouseLeave = () => {
            setIsHovered(false);
        };
        useEffect(() => {
            if (isHovered && videoRef.current) {
                videoRef.current.play()?.catch(() => {});
            }
            else if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }, [isHovered]);
        return (React.createElement("div", { className: "recommended-scene-item", onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, tabIndex: 0, "aria-label": `Scene titled ${scene.title}` },
            React.createElement(Link, { to: `/scenes/${scene.id}`, className: "scene-link", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("div", { className: "scene-thumbnail-wrapper" }, isHovered && ((_a = scene.paths) === null || _a === void 0 ? void 0 : _a.stream) ? (React.createElement("video", { src: scene.paths.stream, className: "scene-thumbnail video-thumbnail", ref: videoRef, muted: true, loop: true, playsInline: true, "aria-label": `Preview of ${scene.title}` })) : (React.createElement("img", { src: ((_b = scene.paths) === null || _b === void 0 ? void 0 : _b.screenshot) || '/ui/images/default_thumbnail.jpg', alt: scene.title, className: "scene-thumbnail" }))),
                React.createElement("span", { className: "scene-title" }, scene.title))));
    };
    const RecommendedScenesPopover = ({ performerId, currentSceneId, }) => {
        const [scenes, setScenes] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const cacheRef = useRef({});
        useEffect(() => {
            let isMounted = true;
            const fetchPerformerScenes = async () => {
                try {
                    if (cacheRef.current[performerId]) {
                        setScenes(cacheRef.current[performerId]);
                        setLoading(false);
                        return;
                    }
                    setLoading(true);
                    const result = await cachedGraphQL(FIND_PERFORMER_QUERY, {id: performerId});
                    if (!isMounted)
                        return;
                    if (result.errors && result.errors.length > 0) {
                        setError('Failed to load scenes.');
                        setLoading(false);
                        return;
                    }
                    const performer = result.data.findScenes;
                    if (performer && performer.scenes) {
                        const filteredScenes = performer.scenes.filter((s) => s.id !== currentSceneId);
                        const recommended = filteredScenes.slice(0, 2);
                        setScenes(recommended);
                        cacheRef.current[performerId] = recommended;
                    }
                    else {
                        setScenes([]);
                    }
                    setLoading(false);
                }
                catch (err) {
                    console.error('Error fetching performer scenes:', err);
                    if (isMounted) {
                        setError('Failed to load scenes.');
                        setLoading(false);
                    }
                }
            };
            fetchPerformerScenes();
            return () => {
                isMounted = false;
            };
        }, [performerId, currentSceneId]);
        if (loading)
            return React.createElement("div", { className: "recommendation-popover" }, "Loading...");
        if (error)
            return React.createElement("div", { className: "recommendation-popover" }, error);
        if (scenes && scenes.length === 0) {
            return null;
        }
        return (React.createElement("div", { className: "recommendation-popover", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("h3", { className: "popover-title" }, "Related Scenes"),
            React.createElement("hr", { className: "popover-divider" }),
            scenes && scenes.map((sc) => React.createElement(SceneItem, { key: sc.id, scene: sc }))));
    };
    const RelatedScenesPopover = ({ tagId, }) => {
        const [scenes, setScenes] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const cacheRef = useRef({});
        useEffect(() => {
            let isMounted = true;
            const fetchTagScenes = async () => {
                try {
                    if (cacheRef.current[tagId]) {

                        setScenes(cacheRef.current[tagId]);
                        setLoading(false);
                        return;
                    }
                    setLoading(true);
                    const result = await cachedGraphQL(FIND_TAG_SCENES_QUERY, {tag_id: [String(tagId)]});

                    if (!isMounted)
                        return;
                    if (result.errors && result.errors.length > 0) {
                        setError('Failed to load related scenes.');
                        setLoading(false);
                        return;
                    }
                    if (result.data.findScenes && result.data.findScenes.scenes) {
                        const related = result.data.findScenes.scenes.slice(0, 2);
                        setScenes(related);
                        cacheRef.current[tagId] = related;
                    }
                    else {
                        setScenes([]);
                    }
                    setLoading(false);
                }
                catch (err) {
                    console.error('Error fetching tag scenes:', err);
                    if (isMounted) {
                        setError('Failed to load related scenes.');
                        setLoading(false);
                    }
                }
            };
            fetchTagScenes();
            return () => {
                isMounted = false;
            };
        }, [tagId]);
        if (loading)
            return React.createElement("div", { className: "related-scenes-popover" }, "Loading...");
        if (error)
            return React.createElement("div", { className: "related-scenes-popover" }, error);
        if (scenes && scenes.length === 0) {
            return (React.createElement("div", { className: "related-scenes-popover" },
                React.createElement("p", null, "No related scenes found.")));
        }
        return (React.createElement("div", { className: "related-scenes-popover", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("h3", { className: "popover-title" }, "Related Scenes"),
            React.createElement("hr", { className: "popover-divider" }),
            scenes && scenes.map((sc) => React.createElement(SceneItem, { key: sc.id, scene: sc }))));
    };
    const MoreListPopover = ({ items, show, target, onHide, onEnter, renderItem, noItemsMessage = 'No items found.', }) => {
        const popoverRef = useRef(null);
        const hideTimeoutRef = useRef(null);
        const [position, setPosition] = useState({ top: 0, left: 0, width: 300 });
        const cancelHide = () => {
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
            }
            if (onEnter) {
                onEnter();
            }
        };
        const scheduleHide = () => {
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
            }
            hideTimeoutRef.current = window.setTimeout(onHide, 90);
        };
        useEffect(() => {
            if (!show || !target) {
                return undefined;
            }
            let frame = null;
            const updatePosition = () => {
                frame = null;
                const targetRect = target.getBoundingClientRect();
                const width = Math.min(360, Math.max(220, window.innerWidth - 24));
                let left = Math.max(12, Math.min(targetRect.left, window.innerWidth - width - 12));
                let top = targetRect.bottom + 6;
                if (popoverRef.current) {
                    const popoverHeight = popoverRef.current.getBoundingClientRect().height;
                    if (top + popoverHeight > window.innerHeight - 12) {
                        top = Math.max(12, targetRect.top - popoverHeight - 6);
                    }
                }
                setPosition(previous => previous.top === top && previous.left === left && previous.width === width
                    ? previous : { top, left, width });
            };
            const handleClickOutside = (event) => {
                if (popoverRef.current &&
                    !popoverRef.current.contains(event.target) &&
                    !target.contains(event.target)) {
                    onHide();
                }
            };
            const schedulePosition = () => { if (frame === null) frame = window.requestAnimationFrame(updatePosition); };
            updatePosition();
            schedulePosition();
            window.addEventListener('resize', schedulePosition);
            window.addEventListener('scroll', schedulePosition, true);
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                if (frame !== null) window.cancelAnimationFrame(frame);
                window.removeEventListener('resize', schedulePosition);
                window.removeEventListener('scroll', schedulePosition, true);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [show, target, items.length]);
        useEffect(() => () => {
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
            }
        }, []);
        if (!show || !target) {
            return null;
        }
        return ReactDOM.createPortal(React.createElement("div", {
            className: "lynx-more-list-popover",
            ref: popoverRef,
            style: {
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`
            },
            onMouseEnter: cancelHide,
            onMouseLeave: scheduleHide,
            onMouseDown: (event) => event.stopPropagation()
        }, React.createElement("div", { className: "more-list-scroll" }, items.length > 0
            ? items.map((item) => renderItem(item))
            : React.createElement("div", { className: "no-results" }, noItemsMessage))), document.body);
    };
    const OverflowPerformerTag = ({ performer }) => {
        const targetRef = useRef(null);
        const hideTimeoutRef = useRef(null);
        const [showPreview, setShowPreview] = useState(false);
        const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
        const imageSrc = performer.image_path || '/ui/images/icon_person.svg';
        const showPerformerPreview = () => {
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
            }
            if (targetRef.current) {
                const rect = targetRef.current.getBoundingClientRect();
                const previewWidth = 132;
                const previewHeight = 226;
                const left = Math.max(12, Math.min(rect.left, window.innerWidth - previewWidth - 12));
                const top = rect.bottom + previewHeight + 8 <= window.innerHeight
                    ? rect.bottom + 8
                    : Math.max(12, rect.top - previewHeight - 8);
                setPreviewPosition({ top, left });
            }
            setShowPreview(true);
        };
        const hidePerformerPreview = () => {
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
            }
            hideTimeoutRef.current = window.setTimeout(() => {
                setShowPreview(false);
            }, 70);
        };
        useEffect(() => () => {
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
            }
        }, []);
        return React.createElement("div", {
            className: "performer-tag-wrapper",
            ref: targetRef,
            onMouseEnter: showPerformerPreview,
            onMouseLeave: hidePerformerPreview
        }, React.createElement(Link, {
            to: `/performers/${performer.id}`,
            className: `performer-tag ${performer.gender}`,
            onMouseDown: (event) => event.stopPropagation()
        }, performer.name), showPreview && ReactDOM.createPortal(React.createElement("div", {
            className: "lynx-overflow-performer-preview",
            style: {
                position: 'fixed',
                top: `${previewPosition.top}px`,
                left: `${previewPosition.left}px`
            }
        }, React.createElement("img", {
            src: imageSrc,
            alt: performer.name || 'Performer',
            className: "lynx-overflow-performer-image"
        }), React.createElement("div", {
            className: "lynx-overflow-performer-name"
        }, performer.name || 'Performer')), document.body));
    };
    const PerformerTag = ({ performer, currentSceneId, }) => {
        const imageSrc = performer.image_path || '/ui/images/icon_person.svg';
        const [showPopover, setShowPopover] = useState(false);
        const [placement, setPlacement] = useState('bottom');
        const targetRef = useRef(null);
        const hoverTimeoutRef = useRef(null);
        useEffect(() => () => window.clearTimeout(hoverTimeoutRef.current), []);
        const handleMouseEnter = () => {
            if (hoverTimeoutRef.current)
                clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = window.setTimeout(() => {
                if (targetRef.current) {
                    const rect = targetRef.current.getBoundingClientRect();
                    const popoverHeight = 400;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const newPlacement = spaceBelow < popoverHeight ? 'top' : 'bottom';
                    setPlacement(newPlacement);
                }
                setShowPopover(true);
            }, 50);
        };
        const handleMouseLeave = () => {
            if (hoverTimeoutRef.current)
                clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = window.setTimeout(() => setShowPopover(false), 200);
        };
        useEffect(() => {
            if (!showPopover) return;
            const handleClickOutside = (event) => {
                if (showPopover &&
                    targetRef.current &&
                    !targetRef.current.contains(event.target)) {
                    const popoverElement = document.getElementById(`popover-${performer.id}`);
                    if (popoverElement && popoverElement.contains(event.target)) {
                        return;
                    }
                    setShowPopover(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [showPopover, performer.id]);
        return (React.createElement("div", { className: "performer-tag-wrapper", onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
            React.createElement(Link, { to: `/performers/${performer.id}`, className: `performer-tag ${performer.gender}`, ref: targetRef, "aria-haspopup": "true", "aria-expanded": showPopover, onMouseDown: (e) => e.stopPropagation() }, performer.name),
            showPopover && React.createElement(Overlay, { show: showPopover, target: targetRef.current, placement: placement, containerPadding: 20 },
                React.createElement(Popover, { id: `popover-${performer.id}`, className: "custom-popover", "aria-label": `Recommended scenes for ${performer.name}`, onMouseDown: (e) => e.stopPropagation() },
                    React.createElement(PopoverContent, { className: "popover-content-container" },
                    React.createElement("div", { className: "popover-flex-container" },
                        React.createElement("div", { className: "performer-hover-profile" },
                            React.createElement("img", { src: imageSrc, alt: performer.name || 'Performer', className: "performer-hover-image" }),
                            React.createElement("div", { className: "performer-hover-name", title: performer.name || 'Performer' }, performer.name || 'Performer'))))))));
    };
    const TagChipWithPopover = ({ tag }) => {
        const [showPopover, setShowPopover] = useState(false);
        const [placement, setPlacement] = useState('bottom');
        const targetRef = useRef(null);
        const hoverTimeoutRef = useRef(null);
        useEffect(() => () => window.clearTimeout(hoverTimeoutRef.current), []);
        const handleMouseEnter = () => {
            if (hoverTimeoutRef.current)
                clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = window.setTimeout(() => {
                if (targetRef.current) {
                    const rect = targetRef.current.getBoundingClientRect();
                    const popoverHeight = 250;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const newPlacement = spaceBelow < popoverHeight ? 'top' : 'bottom';
                    setPlacement(newPlacement);
                }
                setShowPopover(true);
            }, 50);
        };
        const handleMouseLeave = () => {
            if (hoverTimeoutRef.current)
                clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = window.setTimeout(() => setShowPopover(false), 200);
        };
        useEffect(() => {
            if (!showPopover) return;
            const handleClickOutside = (event) => {
                if (showPopover &&
                    targetRef.current &&
                    !targetRef.current.contains(event.target)) {
                    const popoverElement = document.getElementById(`popover-tag-${tag.id}`);
                    if (popoverElement && popoverElement.contains(event.target)) {
                        return;
                    }
                    setShowPopover(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [showPopover, tag.id]);
        return (React.createElement("div", { className: "tag-chip-wrapper", onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
            React.createElement(Link, { to: `/tags/${tag.id}`, className: "tag-chip", ref: targetRef, "aria-haspopup": "true", "aria-expanded": showPopover, onMouseDown: (e) => e.stopPropagation() }, tag.name),
            showPopover && React.createElement(Overlay, { show: showPopover, target: targetRef.current, placement: placement, containerPadding: 20 },
                React.createElement(Popover, { id: `popover-tag-${tag.id}`, className: "custom-popover", "aria-label": `Related scenes for tag ${tag.name}`, onMouseDown: (e) => e.stopPropagation() },
                    React.createElement(PopoverContent, { className: "popover-content-container" },
                        React.createElement("div", { className: "popover-flex-container" },
                            React.createElement(RelatedScenesPopover, { tagId: tag.id })))))));
    };
    const TagChips = ({ tags }) => {
        const [showMore, setShowMore] = useState(false);
        const [moreTarget, setMoreTarget] = useState(null);
        const moreHideTimeoutRef = useRef(null);
        const hasMore = tags.length > 2;
        const displayed = tags.slice(0, 2);
        const moreItems = tags.slice(2); // Remaining tags
        const containerRef = useRef(null);
        const cancelMoreHide = () => {
            if (moreHideTimeoutRef.current) {
                window.clearTimeout(moreHideTimeoutRef.current);
                moreHideTimeoutRef.current = null;
            }
        };
        const scheduleMoreHide = () => {
            cancelMoreHide();
            moreHideTimeoutRef.current = window.setTimeout(() => {
                setShowMore(false);
            }, 90);
        };
        const handleMouseEnter = (e) => {
            cancelMoreHide();
            setMoreTarget(e.currentTarget);
            setShowMore(true);
        };
        useEffect(() => () => cancelMoreHide(), []);
        return (React.createElement("div", { className: "tag-chips-container", ref: containerRef, onMouseLeave: scheduleMoreHide },
            React.createElement("div", { className: "tag-chips" },
                displayed.map((tag) => (React.createElement(TagChipWithPopover, { key: tag.id, tag: tag }))),
                hasMore && (React.createElement("span", { className: "more-indicator", onMouseEnter: handleMouseEnter },
                    "+",
                    tags.length - 2))),
            hasMore && (React.createElement(MoreListPopover, { items: moreItems, show: showMore, target: moreTarget, onHide: () => setShowMore(false), title: "All Tags", renderItem: (tag) => React.createElement(
    "div",
    { className: "tag-chip-wrapper", key: tag.id },
    React.createElement(
        Link,
        {
            to: `/tags/${tag.id}`,
            className: "tag-chip",
            onMouseDown: (e) => e.stopPropagation()
        },
        tag.name
    )
), onEnter: cancelMoreHide, noItemsMessage: "No tags found." }))));
    };
    const PerformerList = ({ performers, currentSceneId, }) => {
        const [showMore, setShowMore] = useState(false);
        const [moreTarget, setMoreTarget] = useState(null);
        const moreHideTimeoutRef = useRef(null);
        const hasMore = performers.length > 2;
        const displayed = performers.slice(0, 2);
        const moreItems = performers.slice(2); // Remaining performers
        const cancelMoreHide = () => {
            if (moreHideTimeoutRef.current) {
                window.clearTimeout(moreHideTimeoutRef.current);
                moreHideTimeoutRef.current = null;
            }
        };
        const scheduleMoreHide = () => {
            cancelMoreHide();
            moreHideTimeoutRef.current = window.setTimeout(() => {
                setShowMore(false);
            }, 90);
        };
        const handleMouseEnter = (e) => {
            cancelMoreHide();
            setMoreTarget(e.currentTarget);
            setShowMore(true);
        };
        useEffect(() => () => cancelMoreHide(), []);
        return (React.createElement("div", { className: "performers-container", onMouseLeave: scheduleMoreHide },
            React.createElement("div", { className: "performers" },
                displayed.map((performer) => (React.createElement(PerformerTag, { performer: performer, key: performer.id, currentSceneId: currentSceneId }))),
                hasMore && (React.createElement("span", { className: "more-indicator", onMouseEnter: handleMouseEnter },
                    "+",
                    performers.length - 2))),
            hasMore && (React.createElement(MoreListPopover, { items: moreItems, show: showMore, target: moreTarget, onHide: () => setShowMore(false), onEnter: cancelMoreHide, renderItem: (performer) => React.createElement(OverflowPerformerTag, { performer: performer, key: performer.id }), noItemsMessage: "No performers found." }))));
    };
    // 6.10. SceneCardDetails Component (Updated with Config)
    const SceneCardDetails = ({ scene }) => {
        var _a, _b;
        const config = useSceneCardConfig();
        const tags = scene.tags
            ? scene.tags.map((tag) => ({ id: tag.id, name: tag.name }))
            : [];
        return (React.createElement("div", { className: "scene-card-content" },
            React.createElement("div", { className: "scene-title-wrapper" },
                React.createElement(Link, { className: "scene-title", to: `/scenes/${scene.id}`, "data-full-text": scene.title, title: scene.title || "Untitled Scene", onMouseDown: (e) => e.stopPropagation() }, scene.title || 'Untitled Scene')),
            config.enablePerformerList && (React.createElement(PerformerList, { performers: scene.performers || [], currentSceneId: scene.id })),
            config.enableFooter && (React.createElement(Footer, { date: ((_b = scene.date) === null || _b === void 0 ? void 0 : _b.toString()) || '', views: scene.play_count || 0, studio: scene.studio || { id: '', name: 'Unknown Studio' } })),
            config.enableTagChips && (React.createElement("div", { className: "tag-resolution-row" },
                React.createElement(TagChips, { tags: tags })))));
    };
    // 7. Wrap SceneCardDetails with Configuration Provider
    const WrappedSceneCardDetails = (props) => {
        return (React.createElement(SceneCardConfigProvider, null,
            React.createElement(SceneCardDetails, { scene: props.scene })));
    };
    // 8. Patch the 'SceneCard.Details' component with the Wrapped Component
    patch.instead('SceneCard.Details', (props) => {
        return React.createElement(WrappedSceneCardDetails, { ...props });
    });
    // 9. Remove 'SceneCard.Popovers' if not needed
    patch.instead('SceneCard.Popovers', () => null);
    window.__lynxSceneCardLoaded = true;
})();
