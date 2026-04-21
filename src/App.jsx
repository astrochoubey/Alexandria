import { useEffect, useMemo, useState } from 'react'
import './App.css'

const GENRES = [
  { key: 'fantasy', label: 'Fantasy', query: 'fantasy' },
  { key: 'sci-fi', label: 'Sci-Fi', query: 'science fiction' },
  { key: 'mystery', label: 'Mystery', query: 'mystery' },
  { key: 'romance', label: 'Romance', query: 'romance' },
]

const SHELVES = [
  { key: 'want', label: 'Want to Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
  { key: 'dropped', label: 'Dropped' },
]

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&w=800&q=80'

function normalizeBook(item) {
  const info = item?.volumeInfo || {}
  const image = info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail

  return {
    id: item?.id || `${info?.title}-${(info?.authors || ['unknown'])[0]}`,
    title: info?.title || 'Untitled',
    author: info?.authors?.join(', ') || 'Unknown Author',
    year: info?.publishedDate ? String(info.publishedDate).slice(0, 4) : 'N/A',
    rating: typeof info?.averageRating === 'number' ? info.averageRating : null,
    ratingsCount: typeof info?.ratingsCount === 'number' ? info.ratingsCount : 0,
    pages: info?.pageCount || 'N/A',
    description: info?.description || 'No description available for this title yet.',
    cover: image ? image.replace('http://', 'https://') : FALLBACK_COVER,
  }
}

function timeAgo(timestamp) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

function App() {
  const [activeGenre, setActiveGenre] = useState(GENRES[0])
  const [searchText, setSearchText] = useState('')
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [library, setLibrary] = useState({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('alexandria-library')
      if (raw) {
        setLibrary(JSON.parse(raw))
      }
    } catch {
      setLibrary({})
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('alexandria-library', JSON.stringify(library))
  }, [library])

  useEffect(() => {
    const controller = new AbortController()

    async function loadBooks() {
      setLoading(true)
      setError('')

      try {
        const query = searchText.trim().length >= 2
          ? searchText.trim()
          : `subject:${activeGenre.query}`

        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&orderBy=relevance&maxResults=24&printType=books`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Unable to load books right now.')
        }

        const data = await response.json()
        setBooks((data?.items || []).map(normalizeBook))
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setError(fetchError.message || 'Unable to load books right now.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadBooks()

    return () => controller.abort()
  }, [activeGenre, searchText])

  const libraryItems = useMemo(() => Object.values(library), [library])

  const shelfCounts = useMemo(() => {
    return {
      want: libraryItems.filter((book) => book.shelf === 'want').length,
      reading: libraryItems.filter((book) => book.shelf === 'reading').length,
      finished: libraryItems.filter((book) => book.shelf === 'finished').length,
      dropped: libraryItems.filter((book) => book.shelf === 'dropped').length,
    }
  }, [libraryItems])

  const currentRead = useMemo(() => {
    return libraryItems.find((book) => book.shelf === 'reading') || books[0]
  }, [libraryItems, books])

  const challengeGoal = 24
  const challengeProgress = Math.min(
    100,
    Math.round((shelfCounts.finished / challengeGoal) * 100),
  )

  const topTrending = books.slice(0, 12)

  const recentActivity = useMemo(() => {
    return libraryItems
      .filter((book) => typeof book.updatedAt === 'number')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 4)
  }, [libraryItems])

  function updateShelf(book, shelf) {
    setLibrary((current) => ({
      ...current,
      [book.id]: {
        ...book,
        shelf,
        updatedAt: Date.now(),
      },
    }))
  }

  return (
    <div className="app-container">
      <aside className="sidebar glass-panel">
        <div className="logo-row">
          <div className="logo-dot">A</div>
          <div>
            <h1>Alexandria</h1>
            <p>Dynamic reading hub</p>
          </div>
        </div>

        <div className="menu-group">
          <h3>Explore</h3>
          {GENRES.map((genre) => (
            <button
              key={genre.key}
              className={genre.key === activeGenre.key ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setActiveGenre(genre)}
            >
              {genre.label}
            </button>
          ))}
        </div>

        <div className="menu-group">
          <h3>Library</h3>
          <p>To Read: {shelfCounts.want}</p>
          <p>Reading: {shelfCounts.reading}</p>
          <p>Finished: {shelfCounts.finished}</p>
          <p>Dropped: {shelfCounts.dropped}</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar glass-panel">
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search books, authors, ISBN..."
          />
          <button
            className="add-btn"
            onClick={() => currentRead && updateShelf(currentRead, 'reading')}
          >
            + Add Book
          </button>
        </header>

        {error && <p className="error-text">{error}</p>}

        <section className="dashboard-grid">
          <article className="hero glass-panel">
            {currentRead && (
              <>
                <div className="hero-content">
                  <p className="eyebrow">Currently Reading</p>
                  <h2>{currentRead.title}</h2>
                  <p className="author">by {currentRead.author}</p>

                  <div className="progress-row">
                    <span>{currentRead.pages} pages</span>
                    <span>
                      {currentRead.rating ? `${currentRead.rating.toFixed(1)} stars` : 'No rating'}
                    </span>
                  </div>

                  <div className="progress-track">
                    <span style={{ width: `${Math.min(96, 35 + shelfCounts.reading * 6)}%` }}></span>
                  </div>

                  <div className="hero-actions">
                    <button onClick={() => updateShelf(currentRead, 'reading')}>Continue Reading</button>
                    <select
                      value={library[currentRead.id]?.shelf || 'want'}
                      onChange={(event) => updateShelf(currentRead, event.target.value)}
                    >
                      {SHELVES.map((shelf) => (
                        <option key={shelf.key} value={shelf.key}>
                          {shelf.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <img src={currentRead.cover} alt={currentRead.title} className="hero-cover" />
              </>
            )}
          </article>

          <aside className="right-widgets">
            <article className="glass-panel widget challenge">
              <h4>2026 Challenge</h4>
              <div className="ring-wrap">
                <div className="ring" style={{ '--p': `${challengeProgress}%` }}>
                  <span>{shelfCounts.finished}</span>
                </div>
              </div>
              <p>{challengeProgress}% of yearly goal</p>
              <small>Goal: {challengeGoal} books</small>
            </article>

            <article className="glass-panel widget stats">
              <div>
                <strong>{shelfCounts.reading}</strong>
                <span>Reading</span>
              </div>
              <div>
                <strong>{shelfCounts.finished}</strong>
                <span>Finished</span>
              </div>
              <div>
                <strong>{libraryItems.length}</strong>
                <span>Total Saved</span>
              </div>
            </article>
          </aside>
        </section>

        <section className="glass-panel trending">
          <div className="section-head">
            <h3>Trending Now</h3>
            <span>{loading ? 'Loading...' : `${topTrending.length} titles`}</span>
          </div>

          <div className="book-row">
            {topTrending.map((book) => (
              <article key={book.id} className="book-card">
                <img src={book.cover} alt={book.title} />
                <h5>{book.title}</h5>
                <p>{book.author}</p>
                <div className="book-meta">
                  <span>{book.year}</span>
                  <span>{book.rating ? book.rating.toFixed(1) : 'N/A'}</span>
                </div>
                <select
                  value={library[book.id]?.shelf || 'want'}
                  onChange={(event) => updateShelf(book, event.target.value)}
                >
                  {SHELVES.map((shelf) => (
                    <option key={shelf.key} value={shelf.key}>
                      {shelf.label}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-panel activity">
          <div className="section-head">
            <h3>Recent Activity</h3>
            <span>Live from your shelves</span>
          </div>

          {recentActivity.length === 0 && <p className="empty">No activity yet. Add books to shelves.</p>}

          {recentActivity.map((book) => (
            <article key={`activity-${book.id}`} className="activity-item">
              <img src={book.cover} alt={book.title} />
              <div>
                <p>
                  <strong>{book.title}</strong> moved to <strong>{SHELVES.find((s) => s.key === book.shelf)?.label}</strong>
                </p>
                <span>{timeAgo(book.updatedAt)}</span>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
