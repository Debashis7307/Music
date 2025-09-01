const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');
const recsDiv = document.getElementById('recommendations');
const audioPlayer = document.getElementById('audioPlayer');

function setSearch(query) {
    searchInput.value = query;
}

function playSong(audioUrl, trackName, button) {
    if (audioUrl.includes('example.com')) {
        alert('Audio preview is not available for this song. This is a demo application.');
        return;
    }
    if (audioPlayer.src !== audioUrl) {
        audioPlayer.src = audioUrl;
    }
    if (audioPlayer.paused) {
        audioPlayer.play().catch(err => {
            alert('Unable to play audio. The audio file may not be available.');
            console.error('Audio play error:', err);
        });
        button.textContent = '⏸️ Pause';
        console.log(`Playing: ${trackName}`);
    } else {
        audioPlayer.pause();
        button.textContent = '▶️ Play';
        console.log(`Paused: ${trackName}`);
    }
}

searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    resultsDiv.innerHTML = '<h2>🔍 Search Results</h2><p>Loading...</p>';
    recsDiv.innerHTML = '';

    fetch(`http://localhost:5000/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                resultsDiv.innerHTML = `<h2>Search Results</h2><p>Error: ${data.error}</p>`;
                return;
            }

            resultsDiv.innerHTML = '<h2>🔍 Search Results</h2>';
            if (data.results.length === 0) {
                resultsDiv.innerHTML += '<p>No songs found. Try a different search.</p>';
                return;
            }

            data.results.forEach(song => {
                const div = document.createElement('div');
                div.className = 'song';
                const genres = song.genres ? song.genres.replace(/[\[\]']/g, '').split(', ').slice(0, 2).join(', ') : '';
                div.innerHTML = `
                    <div class="song-content">
                        ${song.album_cover_64x64 ? `<img src="${song.album_cover_64x64}" alt="Album cover" class="album-cover">` : ''}
                        <div class="song-info">
                            <strong>${song.track_name}</strong><br>
                            <small>by ${song.primary_artist_name}</small><br>
                            <small><em>${song.album_name || 'Unknown Album'}</em></small>
                            ${genres ? `<br><small class="genres">${genres}</small>` : ''}
                        </div>
                        <button class="play-btn" onclick="playSong('${song.audio_url}', '${song.track_name}', this)">▶️ Play</button>
                    </div>
                `;
                div.addEventListener('click', () => getRecommendations(song.track_id, song.track_name));
                resultsDiv.appendChild(div);
            });
        })
        .catch(err => {
            resultsDiv.innerHTML = '<h2>Search Results</h2><p>Error loading results.</p>';
            console.error(err);
        });
});

function getRecommendations(trackId, trackName) {
    recsDiv.innerHTML = `<h2>🎶 Recommendations based on "${trackName}"</h2><p>Loading...</p>`;

    fetch('http://localhost:5000/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                recsDiv.innerHTML = `<h2>Recommendations</h2><p>Error: ${data.error}</p>`;
                return;
            }

            recsDiv.innerHTML = `<h2>🎶 Recommendations based on "${trackName}"</h2>`;
            if (data.recommendations.length === 0) {
                recsDiv.innerHTML += '<p>No recommendations found.</p>';
                return;
            }

            data.recommendations.forEach(song => {
                const div = document.createElement('div');
                div.className = 'song';
                const genres = song.genres ? song.genres.replace(/[\[\]']/g, '').split(', ').slice(0, 2).join(', ') : '';
                div.innerHTML = `
                    <div class="song-content">
                        ${song.album_cover_64x64 ? `<img src="${song.album_cover_64x64}" alt="Album cover" class="album-cover">` : ''}
                        <div class="song-info">
                            <strong>${song.track_name}</strong><br>
                            <small>by ${song.primary_artist_name}</small><br>
                            <small><em>${song.album_name || 'Unknown Album'}</em></small>
                            ${genres ? `<br><small class="genres">${genres}</small>` : ''}
                        </div>
                        <button class="play-btn" onclick="playSong('${song.audio_url}', '${song.track_name}', this)">▶️ Play</button>
                    </div>
                `;
                recsDiv.appendChild(div);
            });
        })
        .catch(err => {
            recsDiv.innerHTML = '<h2>Recommendations</h2><p>Error loading recommendations.</p>';
            console.error(err);
        });
}