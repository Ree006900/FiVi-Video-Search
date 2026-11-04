import { useEffect, useRef, useState } from "react";
import {
  Search,
  Play,
  Clock3,
  AudioLines,
  ArrowUpRight,
  Video,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import "./App.css";
import ReactMarkdown from 'react-markdown';

// FUNGSI HELPER (UTILITY) //

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getYouTubeVideoId(videoUrl) {
  if (!videoUrl) return null;
  try {
    const url = new URL(videoUrl);
    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (videoId) return videoId;
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

function getThumbnailUrl(video) {
  if (video.thumbnail_url) return video.thumbnail_url;
  const videoId = getYouTubeVideoId(video.video_url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === "function") previousCallback();
      resolve(window.YT);
    };
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
}

function highlightText(text, keyword) {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={index}>{part}</mark>
    ) : (
      part
    )
  );
}

// KOMPONEN: YOUTUBE PREVIEW //
function YouTubePreview({ videoId, startTime }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let player = null;
    let cancelled = false;
    let mountNode = null;

    async function createPlayer() {
      try {
        const YT = await loadYouTubeAPI();
        if (cancelled || !containerRef.current) return;
        
        mountNode = document.createElement("div");
        containerRef.current.appendChild(mountNode);
        player = new YT.Player(mountNode, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            playsinline: 1,
            start: Math.floor(Number(startTime) || 0),
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                event.target.destroy();
                return;
              }
              event.target.seekTo(Math.floor(Number(startTime) || 0), true);
              event.target.playVideo();
            },
          },
        });
      } catch (error) {
        console.error("Gagal memuat preview YouTube:", error);
      }
    }
    createPlayer();

    return () => {
      cancelled = true;
      try {
        if (player && typeof player.destroy === "function") player.destroy();
      } catch (error) {
        console.warn("Pembersihan preview:", error);
      }
      if (containerRef.current) {
        containerRef.current.replaceChildren();
      }
    };
  }, [videoId, startTime]);

  return <div className="video-preview-frame" ref={containerRef} />;
}

// KOMPONEN: CUSTOM DROPDOWN (Pilih Folder Lokal) //
function CustomDropdown({ sources, selectedFolder, setSelectedFolder }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDisplayLabel = () => {
    if (selectedFolder === "all_local") return "📁 Pencarian di Semua Folder";
    return "📁 " + selectedFolder.replace("Folder: ", "");
  };

  return (
    <div className="custom-dropdown-container" ref={dropdownRef}>
      <div 
        className={`custom-dropdown-header ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-dropdown-text">
          {getDisplayLabel()}
        </span>
        <span className="custom-dropdown-icon">
          ▼
        </span>
      </div>

      {isOpen && (
        <div className="custom-dropdown-list">
          <div 
            className={`custom-dropdown-item ${selectedFolder === "all_local" ? "selected" : ""}`}
            onClick={() => {
              setSelectedFolder("all_local");
              setIsOpen(false);
            }}
          >
            📂 Pencarian di Semua Folder
          </div>

          {sources.map((src, index) => (
            <div 
              key={index}
              className={`custom-dropdown-item ${selectedFolder === src ? "selected" : ""}`}
              onClick={() => {
                setSelectedFolder(src);
                setIsOpen(false);
              }}
            >
              📁 {src.replace("Folder: ", "")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// KOMPONEN UTAMA: APP //
export default function App() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [cardPages, setCardPages] = useState({});

  const [showAddVideo, setShowAddVideo] = useState(false);
  const [addMode, setAddMode] = useState("youtube"); 
  const [videoUrl, setVideoUrl] = useState("");
  const [localVideoPath, setLocalVideoPath] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [addVideoMessage, setAddVideoMessage] = useState("");
  const [addVideoError, setAddVideoError] = useState("");
  
  const [activeQueue, setActiveQueue] = useState([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  
  const [searchTab, setSearchTab] = useState("youtube");
  const [sources, setSources] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("all_local");
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSection, setActiveSection] = useState("beranda");
  const [isHowSectionVisible, setIsHowSectionVisible] = useState(false);
  
  const [hoveredVideoId, setHoveredVideoId] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);

  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [activeVideoForSummary, setActiveVideoForSummary] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef(null);

  const isNavigating = useRef(false);
  const isClickScrolling = useRef(false);

  // EFFECT HOOKS //

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isAiTyping]);

  useEffect(() => {
    const handleScroll = () => {
      if (!isClickScrolling.current && window.scrollY < 50) {
        setActiveSection("beranda");
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function fetchSources() {
      try {
        const res = await fetch("/api/search/sources");
        const result = await res.json();
        if (res.ok) setSources(result.data || []);
      } catch (err) {
        console.error("Gagal mengambil daftar sumber:", err);
      }
    }
    fetchSources();
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll("#beranda, #hasil, #cara-kerja");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            if (entry.target.id === "cara-kerja") {
              setIsHowSectionVisible(true);
            }
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" } 
    );
    sections.forEach((section) => {
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchQueue() {
      try {
        const response = await fetch("/api/videos/queue");
        const result = await response.json();
        if (isMounted && response.ok) {
          const queueData = result.data || [];
          setActiveQueue(queueData);
          if (queueData.length > 0) setIsQueueOpen(true);
        }
      } catch (err) {
        console.warn("Gagal memuat status antrean:", err);
      }
    }
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);  

  // HANDLERS //

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    isNavigating.current = true;
    setTimeout(() => {
      isNavigating.current = false;
    }, 800);
  };

  async function handleAskAi(video, question = null) {
    if (!question) {
      setChatHistory([{ role: "ai", text: "Sedang membuat rangkuman..." }]);
    } else {
      setChatHistory((prev) => [...prev, { role: "user", text: question }]);
    }
    
    setIsAiTyping(true);
    setChatInput("");

    try {
      const response = await fetch(`/api/videos/${video.id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setChatHistory((prev) => {
        const cleanHistory = prev.filter(msg => msg.text !== "Sedang membuat rangkuman...");
        return [...cleanHistory, { role: "ai", text: data.answer }];
      });
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: "ai", text: `Error: ${err.message}` }]);
    } finally {
      setIsAiTyping(false);
    }
  }

  function openSummary(video) {
    setActiveVideoForSummary(video);
    setSummaryModalOpen(true);
    handleAskAi(video, null); 
  }

  async function handleSyncFolder() {
    if (selectedFolder === "all_local") return;
    setIsSyncing(true);
    try {
      const response = await fetch("/api/videos/sync-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ source: selectedFolder }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message); 
        setResults([]); 
        setHasSearched(false);
        setIsQueueOpen(true); 
      } else {
        alert(data.message || "Gagal melakukan sinkronisasi.");
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan saat sinkronisasi.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSearch(event, page = 1) {
    event?.preventDefault();
    const keyword = page > 1 ? searchedQuery : query.trim();

    if (keyword.length < 2) {
      setError("Masukkan minimal 2 karakter untuk mencari.");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);
    setSearchedQuery(keyword);
    setResults([]);
    setPreviewTarget(null);
    document.getElementById("hasil")?.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      let sourceParam = 'all';
      if (searchTab === 'youtube') sourceParam = 'youtube';
      else if (searchTab === 'local') sourceParam = selectedFolder === 'all_local' ? 'local' : selectedFolder;

      const endpoint = `/api/search?q=${encodeURIComponent(keyword)}&page=${page}&source=${encodeURIComponent(sourceParam)}`;
      const response = await fetch(endpoint);
      let data;

      try {
        data = await response.json();
      } catch {
        if (!response.ok) throw new Error("Server tidak dapat memproses pencarian. Pastikan Laravel berjalan.");
        throw new Error("Respons server tidak valid. Silakan coba lagi.");
      }

      if (!response.ok) throw new Error(data.message || "Pencarian gagal. Silakan coba lagi.");

      const searchResults = data.data || [];
      const total = Number(data.total ?? searchResults.length);

      setResults(searchResults);
      setTotalResults(total);
      setCurrentPage(Number(data.current_page ?? page));
      setLastPage(Math.max(1, Number(data.last_page ?? Math.ceil(total / 30))));
    } catch (err) {
      console.error("Pencarian FiVi gagal:", err);
      if (err instanceof TypeError) setError("Tidak dapat menghubungi server. Pastikan Laravel berjalan.");
      else setError(err.message || "Pencarian gagal. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function openVideo(video) {
    if (!video.video_url) {
      setError("Tautan video belum tersedia.");
      return;
    }
    try {
      if (video.source === 'YouTube' || video.source === 'youtube') {
        const url = new URL(video.video_url);
        url.searchParams.set("t", String(video.start_time || 0));
        window.open(url.toString(), "_blank", "noopener,noreferrer");
      } else {
        const localUrl = `http://localhost:8000/api/play-local?path=${encodeURIComponent(video.video_url)}#t=${video.start_time || 0}`;
        window.open(localUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Tautan video tidak valid.");
    }
  }

  async function handleAddVideo(event) {
    event.preventDefault();
    setAddVideoError("");
    setAddingVideo(true);

    try {
      let response;
      if (addMode === "youtube") {
        const url = videoUrl.trim();
        if (!url) { setAddVideoError("URL video wajib diisi."); setAddingVideo(false); return; }
        if (!getYouTubeVideoId(url)) { setAddVideoError("Masukkan URL YouTube yang valid."); setAddingVideo(false); return; }

        let fetchedTitle = null;
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
          const ytResponse = await fetch(oembedUrl);
          if (ytResponse.ok) {
            const ytData = await ytResponse.json();
            fetchedTitle = ytData.title; 
          }
        } catch (error) {
          console.warn("Gagal mengambil judul YouTube, menggunakan default.");
        }

        response = await fetch("/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ url, title: fetchedTitle }),
        });
      } else {
        const path = localVideoPath.trim();
        if (!path) { setAddVideoError("Path video lokal wajib diisi."); setAddingVideo(false); return; }

        response = await fetch("/api/videos/local", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ path }),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Video gagal ditambahkan.");

      setVideoUrl("");
      setLocalVideoPath("");
      setAddVideoMessage("Video masuk antrean. Silakan tambah video lain.");
      setIsQueueOpen(true);

      const queueRes = await fetch("/api/videos/queue");
      const queueData = await queueRes.json();
      if (queueRes.ok) setActiveQueue(queueData.data || []);
      
    } catch (err) {
      console.error("Error tambah video:", err);
      if (err instanceof TypeError) setAddVideoError("Gagal menghubungi server Laravel.");
      else setAddVideoError(err.message || "Terjadi kesalahan.");
    } finally {
      setAddingVideo(false);
    }
  }

  async function handleCancelVideo(videoId) {
    if (!window.confirm("Batalkan dan hapus video ini dari antrean?")) return;
    try {
      const response = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      if (response.ok) setActiveQueue(prevQueue => prevQueue.filter(v => v.id !== videoId));
      else alert("Gagal membatalkan video.");
    } catch (err) {
      console.error("Error membatalkan video:", err);
    }
  }

  const groupedResults = results.map((video) => ({
    ...video,
    groupKey: video.video_id ?? video.id,
    matches: Array.isArray(video.matches)
      ? video.matches
      : [{
          id: video.id,
          text: video.text ?? "",
          start_time: video.start_time ?? 0,
          end_time: video.end_time ?? 0,
          context_before: video.context_before ?? null,
          context_after: video.context_after ?? null,
        }],
  }));

  // UI UTAMA
  return (
    <div className="app">
      {/* NAVBAR */}
      <header className="navbar">
        <a className="brand" href="#beranda">
          <span className="brand-icon"><AudioLines size={23} /></span>
          <span>FiVi<span className="brand-period">.</span></span>
        </a>

        <nav className="nav-links">
          <a className={`nav-link ${activeSection === 'beranda' ? 'active' : ''}`} href="#beranda" onClick={() => handleNavClick('beranda')}>Beranda</a>
          <a className={`nav-link ${activeSection === 'cara-kerja' ? 'active' : ''}`} href="#cara-kerja" onClick={() => handleNavClick('cara-kerja')}>Cara Kerja</a>
        </nav>

        <div className="nav-actions">
          <button type="button" className="add-video-button" onClick={() => { setShowAddVideo(true); setAddVideoMessage(""); setAddVideoError(""); }}>
            <Plus size={17} /> Tambah Video
          </button>
          <a className="nav-action" href="#hasil">Jelajahi <ArrowUpRight size={16} /></a>
        </div>
      </header>

      {/* MODAL TAMBAH VIDEO & ANTREAN */}
      {showAddVideo && (
        <div className="add-video-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !addingVideo) setShowAddVideo(false); }}>
          <section className="add-video-modal" role="dialog">
            <div className="add-video-heading">
              <div>
                <span className="eyebrow">KOLEKSI VIDEO</span>
                <h2>Tambah Video</h2>
                <p>Masukkan video YouTube atau direktori lokal.</p>
              </div>
              <button type="button" className="add-video-close" disabled={addingVideo} onClick={() => setShowAddVideo(false)}>
                <X size={20} />
              </button>
            </div>

            <form className="add-video-form" onSubmit={handleAddVideo}>
              <div className="mode-toggle-group">
                <div className={`mode-card-option ${addMode === 'youtube' ? 'active' : ''}`} onClick={() => !addingVideo && setAddMode("youtube")}>
                  <span className="mode-card-title">YouTube URL</span>
                  <span className="mode-card-desc">Proses dari tautan video</span>
                </div>
                <div className={`mode-card-option ${addMode === 'local' ? 'active' : ''}`} onClick={() => !addingVideo && setAddMode("local")}>
                  <span className="mode-card-title">Video Lokal</span>
                  <span className="mode-card-desc">Scan direktori folder PC</span>
                </div>
              </div>

              {addMode === "youtube" ? (
                <>
                  <label htmlFor="video-url">URL YouTube</label>
                  <input id="video-url" type="url" placeholder="https://www.youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} disabled={addingVideo} />
                </>
              ) : (
                <>
                  <label htmlFor="local-path">Lokasi File Video (Path)</label>
                  <input id="local-path" type="text" placeholder="Contoh: D:\Folder\Videos" value={localVideoPath} onChange={(e) => setLocalVideoPath(e.target.value)} disabled={addingVideo} />
                </>
              )}

              <p className="add-video-note">
                {addMode === "youtube" ? "FiVi akan mengekstrak audio dari YouTube." : "FiVi akan membaca video langsung dari partisi PC Anda."}
              </p>

              {addingVideo && (
                <div className="add-video-feedback processing" role="status">
                  <span className="loading-spinner" />
                  <div className="processing-info">
                    <strong>Mendaftarkan ke antrean...</strong>
                    <div className="modal-progress-bar">
                      <div className="modal-progress-fill" style={{ width: `100%` }} />
                    </div>
                  </div>
                </div>
              )}

              {addVideoError && <div className="add-video-feedback error" role="alert">{addVideoError}</div>}
              {addVideoMessage && !addingVideo && <div className="add-video-feedback success" role="status">{addVideoMessage}</div>}

              <button type="submit" className="add-video-submit" disabled={addingVideo}>
                {addingVideo ? "Memproses..." : <><Plus size={17} /> Tambahkan Video</>}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* MODAL RANGKUMAN AI */}
      {summaryModalOpen && activeVideoForSummary && (
        <div className="add-video-overlay" onClick={() => !isAiTyping && setSummaryModalOpen(false)}>
          <div className="add-video-modal summary-modal" onClick={e => e.stopPropagation()}>
            <div className="add-video-heading">
              <div>
                <span className="eyebrow">AI ASSISTANT</span>
                <h2>Rangkuman & Chat</h2>
                <p>{activeVideoForSummary.title}</p>
              </div>
              <button className="add-video-close" onClick={() => setSummaryModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="chat-container">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message-wrapper ${msg.role}`}>
                  <div className={`chat-bubble ${msg.role} markdown-content`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAiTyping && <div className="chat-typing">AI sedang mengetik...</div>}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-form" onSubmit={(e) => { e.preventDefault(); handleAskAi(activeVideoForSummary, chatInput); }}>
              <input type="text" className="chat-input" placeholder="Tanyakan sesuatu..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isAiTyping} />
              <button type="submit" className="add-video-submit chat-submit" disabled={isAiTyping || !chatInput.trim()}>Kirim</button>
            </form>
          </div>
        </div>
      )} 

      <main>
        {/* BAGIAN HERO & PENCARIAN */}
        <section className="hero" id="beranda">
          <div className="hero-badge"><Sparkles size={14} /><span>Pencarian video berbasis ucapan</span></div>
          <h1>Find the words.<br /><span>Find the moment.</span></h1>
          <p className="hero-description">Temukan momen dalam video hanya dengan mencari kata atau kalimat yang diucapkan.</p>

          <div className="search-tabs-container">
            <button className={`search-tab ${searchTab === 'youtube' ? 'active' : ''}`} onClick={() => { setSearchTab('youtube'); setResults([]); setHasSearched(false); }}>YouTube</button>
            <button className={`search-tab ${searchTab === 'local' ? 'active' : ''}`} onClick={() => { setSearchTab('local'); setResults([]); setHasSearched(false); }}>Video Lokal</button>
          </div>

          {searchTab === 'local' && sources.length > 0 && (
            <div className="folder-select-wrapper">
              <CustomDropdown sources={sources} selectedFolder={selectedFolder} setSelectedFolder={setSelectedFolder} />
              {selectedFolder !== "all_local" && <button className="sync-button" onClick={handleSyncFolder} disabled={isSyncing}>{isSyncing ? "Memeriksa..." : "🔄 Sync"}</button>}
            </div>
          )}

          <form className="search-form" onSubmit={handleSearch}>
            <Search size={22} className="search-icon" />
            <input type="text" placeholder={searchTab === 'youtube' ? "Cari ucapan di YouTube..." : "Cari ucapan di video lokal..."} value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" disabled={loading}>{loading ? "Mencari..." : "Cari"}{!loading && <ArrowUpRight size={17} />}</button>
          </form>

          <div className="search-hint"><span className="hint-dot" /> Cari berdasarkan ucapan, bukan hanya judul video.</div>

          <div className="hero-stats">
            <div className="stat"><span className="stat-icon"><Search size={18} /></span><div><strong>Lebih spesifik</strong><span>Cari berdasarkan kata</span></div></div>
            <div className="stat"><span className="stat-icon"><Clock3 size={18} /></span><div><strong>Langsung ke momen</strong><span>Temukan timestamp</span></div></div>
            <div className="stat"><span className="stat-icon"><Video size={18} /></span><div><strong>Satu pencarian</strong><span>Banyak kemungkinan video</span></div></div>
          </div>
        </section>

        {/* BAGIAN HASIL PENCARIAN */}
        <section className="results-section" id="hasil">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{hasSearched ? "HASIL PENCARIAN" : "PENCARIAN VIDEO"}</span>
              <h2>{hasSearched ? `Hasil untuk "${searchedQuery}"` : "Temukan momen penting"}</h2>
              <p>{hasSearched ? `${totalResults} hasil ditemukan` : "Cari kata atau kalimat untuk menemukan ucapan dalam video."}</p>
            </div>
            {hasSearched && <span className="results-count">{totalResults} hasil</span>}
          </div>

          {error && <div className="demo-notice" role="alert"><span>{error}</span></div>}
          {!hasSearched && <div className="empty-state"><span className="empty-icon"><Search size={27} /></span><h3>Mulai pencarian pertamamu</h3></div>}
          {loading && <div className="empty-state"><p>Sedang mencari transkrip...</p></div>}
          {hasSearched && !loading && !error && results.length === 0 && <div className="empty-state"><span className="empty-icon"><Search size={27} /></span><h3>Belum ada hasil yang cocok</h3></div>}

          <div className="video-grid">
            {!loading && groupedResults.map((video) => (
                <article className="video-card" key={video.groupKey}>
                  <div className="video-thumbnail" onMouseEnter={() => setHoveredVideoId(video.groupKey)} onMouseLeave={() => setHoveredVideoId(null)}>
                    {getThumbnailUrl(video) ? <img src={getThumbnailUrl(video)} alt={`Thumbnail ${video.title}`} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="empty-icon"><Video size={27} /></div>}
                    
                    {previewTarget?.groupKey === video.groupKey && (
                      video.source === 'YouTube' ? (
                        <YouTubePreview key={`${video.groupKey}-${previewTarget.time}`} videoId={getYouTubeVideoId(video.video_url)} startTime={previewTarget.time} />
                      ) : (
                        <video src={`http://localhost:8000/api/play-local?path=${encodeURIComponent(video.video_url)}#t=${previewTarget.time}`} autoPlay className="video-preview-frame" />
                      )
                    )}

                    {video.duration_seconds != null && <span className="duration">{formatTime(video.duration_seconds)}</span>}
                    <button className="play-button" onClick={() => openVideo(video)}><Play size={19} fill="currentColor" /></button>
                  </div>

                  <div className="video-content">
                    <div className="video-meta"><span className="source-dot" />{video.source}</div>
                    <h3>{video.title}</h3>

                    <div className="video-matches">
                      {(() => {
                        const matchIndex = Math.min(cardPages[video.groupKey] ?? 0, video.matches.length - 1);
                        const match = video.matches[matchIndex];
                        if (!match) return null;

                        return (
                          <>
                            <div className="match-counter">
                              <span>Timestamp {matchIndex + 1} dari {video.matches.length}</span>
                              <span className="match-counter-dot" />
                              <span>{formatTime(match.start_time)}</span>
                            </div>

                            <div className="video-match" key={match.id ?? matchIndex}>
                              <button type="button" className="timestamp" 
                                onMouseEnter={() => setPreviewTarget({ groupKey: video.groupKey, time: Number(match.start_time) || 0 })} 
                                onMouseLeave={() => setPreviewTarget(null)}
                                onClick={() => openVideo({ ...video, ...match })}>
                                <Clock3 size={14} />{formatTime(match.start_time)}<span>Lihat ucapan</span>
                              </button>
                              <p className="transcript">“{highlightText(match.text, searchedQuery)}”</p>

                              {(match.context_before || match.context_after) && (
                                <details className="match-context">
                                  <summary>Lihat konteks ucapan</summary>
                                  {match.context_before && <div className="context-item"><span className="context-label">Sebelumnya</span><p>{match.context_before.text}</p></div>}
                                  {match.context_after && <div className="context-item"><span className="context-label">Sesudahnya</span><p>{match.context_after.text}</p></div>}
                                </details>
                              )}
                            </div>

                            {video.matches.length > 1 && (
                              <div className="match-pagination">
                                <button type="button" className="match-page-button" disabled={matchIndex === 0} onClick={() => { setPreviewTarget(null); setCardPages((prev) => ({ ...prev, [video.groupKey]: matchIndex - 1 })); }}>‹ Sebelumnya</button>
                                <span className="match-page-number">{matchIndex + 1}/{video.matches.length}</span>
                                <button type="button" className="match-page-button" disabled={matchIndex >= video.matches.length - 1} onClick={() => { setPreviewTarget(null); setCardPages((prev) => ({ ...prev, [video.groupKey]: matchIndex + 1 })); }}>Berikutnya ›</button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="card-actions">
                      <button className="action-btn secondary" onClick={() => { const activeIndex = Math.min(cardPages[video.groupKey] ?? 0, video.matches.length - 1); openVideo({ ...video, ...video.matches[activeIndex] }); }}>Lihat momen <ArrowUpRight size={15} /></button>
                      <button className="action-btn primary" onClick={() => openSummary(video)}><Sparkles size={14} /> Rangkum & AI</button>
                    </div>
                  </div>
                </article>
              ))}
          </div>

          {hasSearched && totalResults > 0 && !error && (
            <div className="pagination">
              <button type="button" className="pagination-button" disabled={loading || currentPage <= 1} onClick={() => handleSearch(null, currentPage - 1)}>Sebelumnya</button>
              <span className="pagination-info">Halaman {currentPage} dari {lastPage}</span>
              <button type="button" className="pagination-button" disabled={loading || currentPage >= lastPage} onClick={() => handleSearch(null, currentPage + 1)}>Berikutnya</button>
            </div>
          )}
        </section>

        {/* BAGIAN CARA KERJA */}
        <section className={`how-section ${isHowSectionVisible ? "is-visible" : ""}`} id="cara-kerja">
          <span className="eyebrow">CARA KERJA</span>
          <h2>Dari kata ke momen video.</h2>
          <p className="how-description">FiVi dirancang untuk mempermudah pencarian ucapan dalam video.</p>
          <div className="steps-grid">
            <div className="step-card"><span className="step-number">01</span><Search size={23} /><h3>Cari kata</h3><p>Masukkan kata atau kalimat yang ingin ditemukan.</p></div>
            <div className="step-card"><span className="step-number">02</span><AudioLines size={23} /><h3>Telusuri ucapan</h3><p>Transkrip audio digunakan untuk menemukan kecocokan.</p></div>
            <div className="step-card"><span className="step-number">03</span><Play size={23} /><h3>Buka momennya</h3><p>Lihat timestamp agar mudah menuju bagian video.</p></div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <a className="brand footer-brand" href="#beranda"><span className="brand-icon"><AudioLines size={20} /></span><span>FiVi<span className="brand-period">.</span></span></a>
        <p>Find the words. Find the moment.</p>
        <span>© 2026 FiVi · Find Video</span>
      </footer>

      {/* FLOATING QUEUE (PANEL ANTREAN) */}
      {activeQueue.length > 0 && (
        <aside className="floating-queue-container" aria-label="Antrean transkripsi">
          {!isQueueOpen ? (
            <button type="button" className="queue-trigger-btn" onClick={() => setIsQueueOpen(true)}>
              <AudioLines size={16} /><span>Memproses Transkripsi</span><span className="queue-badge">{activeQueue.length}</span>
            </button>
          ) : (
            <div className="queue-panel">
              <div className="queue-header">
                <div className="queue-header-title"><AudioLines size={16} color="var(--primary)" /><span>Antrean Transkripsi ({activeQueue.length})</span></div>
                <button type="button" className="queue-close-btn" onClick={() => setIsQueueOpen(false)} title="Minimize"><X size={16} /></button>
              </div>
              <div className="queue-list">
                {activeQueue.map((item) => (
                  <div className="queue-item" key={item.id}>
                    <img src={item.thumbnail_url || `https://img.youtube.com/vi/${getYouTubeVideoId(item.video_url)}/hqdefault.jpg`} alt={item.title} className="queue-thumb" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="queue-info">
                      <p className="queue-item-title" title={item.title}>{item.title}</p>
                      <div className="queue-progress-bar">
                        {/* Inline style hanya untuk mengatur lebar baris progress ini */}
                        <div className="queue-progress-fill" style={{ width: `${item.transcription_progress || 0}%` }} />
                      </div>
                      <div className="queue-status-text">
                        <span>{item.transcription_status === "pending" ? "Dalam antrean..." : item.transcription_status === "failed" ? "Gagal (Silakan Hapus)" : "Mentranskripsi..."}</span>
                        <span>{item.transcription_progress || 0}%</span>
                      </div>
                      <button className="cancel-item-btn" onClick={() => handleCancelVideo(item.id)} title="Batalkan antrean ini">✕ Batal</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}