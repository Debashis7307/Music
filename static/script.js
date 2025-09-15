const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');
const recsDiv = document.getElementById('recommendations');
const audioPlayer = document.getElementById('audioPlayer');
const xaiModal = document.getElementById('xaiModal');
const xaiContent = document.getElementById('xaiContent');
const lottieGif = document.querySelector('dotlottie-wc');

let currentChart = null; // Store reference to current chart for cleanup
let currentLimeChart = null; // Store reference to LIME chart for cleanup
let currentRecommendations = {}; // Store current recommendations data

function setSearch(query) {
    searchInput.value = query;
}

function closeXAIModal() {
    const modal = xaiModal;
    const modalContent = modal.querySelector('.modal-content');

    // Add closing animation
    modalContent.style.animation = 'slideUpToTop 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
    modal.style.animation = 'modalFadeOut 0.3s ease-out';

    setTimeout(() => {
        modal.style.display = 'none';
        // Reset animations for next open
        modalContent.style.animation = '';
        modal.style.animation = '';

        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }

        if (currentLimeChart) {
            currentLimeChart.destroy();
            currentLimeChart = null;
        }

        if (currentShapChart) {
            currentShapChart.destroy();
            currentShapChart = null;
        }

        updateGifVisibility();
    }, 300);
}

function showXAIExplanation(explanation, originalSong, recommendedSong) {
    // Clone the template
    const template = document.getElementById('xaiTemplate');
    const clone = template.content.cloneNode(true);

    // Clear previous content
    xaiContent.innerHTML = '';

    // Populate similarity score
    const scoreText = clone.querySelector('.score-text');
    scoreText.textContent = `${explanation.overall_similarity}%`;

    // Add color coding for similarity score
    const scoreCircle = clone.querySelector('.score-circle');
    if (explanation.overall_similarity >= 80) {
        scoreCircle.className += ' high-similarity';
    } else if (explanation.overall_similarity >= 60) {
        scoreCircle.className += ' medium-similarity';
    } else {
        scoreCircle.className += ' low-similarity';
    }

    // Populate top features
    const featuresList = clone.querySelector('.features-list');
    explanation.top_matching_features.forEach(feature => {
        const featureDiv = document.createElement('div');
        featureDiv.className = 'feature-item';
        featureDiv.innerHTML = `
            <div class="feature-info">
                <strong>${feature.feature}</strong>
                <span class="feature-description">${feature.description}</span>
            </div>
            <div class="feature-score">${feature.similarity}%</div>
        `;
        featuresList.appendChild(featureDiv);
    });

    // Populate reasoning
    const reasoningText = clone.querySelector('.reasoning-text');
    explanation.reasoning.forEach(reason => {
        const p = document.createElement('p');
        p.textContent = reason;
        reasoningText.appendChild(p);
    });

    // Create detailed comparison table
    const comparisonTable = clone.querySelector('.comparison-table');
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Feature</th>
                <th>Original Song</th>
                <th>Recommended Song</th>
                <th>Similarity</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    Object.entries(explanation.feature_comparison).forEach(([feature, data]) => {
        const row = document.createElement('tr');
        const similarityClass = data.similarity >= 80 ? 'high' :
            data.similarity >= 60 ? 'medium' : 'low';

        row.innerHTML = `
            <td><strong>${feature}</strong><br><small>${data.description}</small></td>
            <td>${data.original}</td>
            <td>${data.recommended}</td>
            <td class="similarity-${similarityClass}">${data.similarity}%</td>
        `;
        tbody.appendChild(row);
    });

    comparisonTable.appendChild(table);

    // Append to modal
    xaiContent.appendChild(clone);

    // Create feature chart
    createFeatureChart(explanation.feature_comparison);
    
    // Handle LIME explanation if available
    if (explanation.lime_explanation && explanation.lime_explanation.available) {
        displayLimeExplanation(explanation.lime_explanation, clone);
    }

    // Handle SHAP explanation if available
    if (explanation.shap_explanation && explanation.shap_explanation.available) {
        displayShapExplanation(explanation.shap_explanation, clone);
    }

    // Show modal
    xaiModal.style.display = 'block';
}

function createFeatureChart(featureComparison) {
    const ctx = document.getElementById('featureChart');

    // Destroy existing chart if any
    if (currentChart) {
        currentChart.destroy();
    }

    const features = Object.keys(featureComparison);
    const similarities = features.map(f => featureComparison[f].similarity);

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: features,
            datasets: [{
                label: 'Feature Similarity (%)',
                data: similarities,
                backgroundColor: similarities.map(s =>
                    s >= 80 ? '#4CAF50' :
                        s >= 60 ? '#FF9800' : '#F44336'
                ),
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function (context) {
                            const feature = context.label;
                            return featureComparison[feature].description;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Similarity (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Audio Features'
                    },
                    ticks: {
                        maxRotation: 45
                    }
                }
            }
        }
    });
}

function showXAIModal(trackId, trackName, artistName, originalTrackName) {
    // Find the recommendation data
    const recData = currentRecommendations[trackId];
    if (!recData) {
        alert('XAI explanation data not available for this song.');
        return;
    }

    // Show the explanation
    showXAIExplanation(
        recData.xai_explanation,
        { track_name: originalTrackName },
        { track_name: trackName, artist: artistName }
    );

    updateGifVisibility();
}

function showSearchResultExplanation(trackId, trackName, searchQuery) {
    // Fetch real explanation from backend
    fetch(`http://localhost:5000/search_explain/${trackId}/${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('Error loading explanation: ' + data.error);
                return;
            }

            // Show the real explanation
            showXAIExplanation(
                data.explanation,
                { track_name: `Search: "${searchQuery}"` },
                { track_name: trackName }
            );

            updateGifVisibility();
        })
        .catch(err => {
            console.error('Error fetching search explanation:', err);
            alert('Error loading explanation. Please try again.');
        });
}

function displayLimeExplanation(limeExplanation, clone) {
    const limeSection = clone.querySelector('.lime-explanation');
    if (!limeSection) return;
    
    limeSection.style.display = 'block';
    
    // Display LIME score
    const scoreValue = clone.querySelector('.lime-score-value');
    if (scoreValue && limeExplanation.explanation_score) {
        scoreValue.textContent = limeExplanation.explanation_score.toFixed(3);
    }
    
    // Display top LIME features
    const limeFeaturesList = clone.querySelector('.lime-features-list');
    if (limeFeaturesList && limeExplanation.top_features) {
        limeExplanation.top_features.forEach(feature => {
            const featureDiv = document.createElement('div');
            featureDiv.className = 'lime-feature-item';
            const importanceClass = feature.direction === 'positive' ? 'lime-positive' : 'lime-negative';
            featureDiv.innerHTML = `
                <div class="lime-feature-info">
                    <strong>${feature.feature}</strong>
                    <span class="lime-feature-description">${feature.description}</span>
                </div>
                <div class="lime-importance ${importanceClass}">
                    ${feature.direction === 'positive' ? '+' : ''}${feature.importance.toFixed(3)}
                </div>
            `;
            limeFeaturesList.appendChild(featureDiv);
        });
    }
    
    // Create LIME chart
    setTimeout(() => {
        createLimeChart(limeExplanation.feature_importances);
    }, 100);
}

function createLimeChart(featureImportances) {
    const ctx = document.getElementById('limeChart');
    if (!ctx) return;
    
    // Destroy existing LIME chart if any
    if (currentLimeChart) {
        currentLimeChart.destroy();
    }
    
    const features = Object.keys(featureImportances);
    const importances = features.map(f => featureImportances[f].importance);
    
    currentLimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: features,
            datasets: [{
                label: 'LIME Feature Importance',
                data: importances,
                backgroundColor: importances.map(imp => 
                    imp > 0 ? '#4CAF50' : '#F44336'
                ),
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // This makes it horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const feature = context.label;
                            const direction = context.parsed.x > 0 ? 'increases' : 'decreases';
                            return `This feature ${direction} similarity`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Feature Importance'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Audio Features'
                    }
                }
            }
        }
    });
}

function displayShapExplanation(shapExplanation, clone) {
    const shapSection = clone.querySelector('.shap-explanation');
    if (!shapSection) return;

    shapSection.style.display = 'block';

    // Display SHAP features
    const shapFeaturesList = clone.querySelector('.shap-features-list');
    if (shapFeaturesList && shapExplanation.feature_importances) {
        const sortedFeatures = Object.entries(shapExplanation.feature_importances)
            .sort((a, b) => Math.abs(b[1].importance) - Math.abs(a[1].importance));

        sortedFeatures.forEach(([feature, data]) => {
            const featureDiv = document.createElement('div');
            featureDiv.className = 'shap-feature-item';
            const importanceClass = data.importance > 0 ? 'shap-positive' : 'shap-negative';
            featureDiv.innerHTML = `
                <div class="shap-feature-info">
                    <strong>${feature}</strong>
                    <span class="shap-feature-description">${data.description}</span>
                </div>
                <div class="shap-importance ${importanceClass}">
                    ${data.importance > 0 ? '+' : ''}${data.importance.toFixed(3)}
                </div>
            `;
            shapFeaturesList.appendChild(featureDiv);
        });
    }

    // Create SHAP chart
    setTimeout(() => {
        createShapChart(shapExplanation.feature_importances);
    }, 100);
}

function createShapChart(featureImportances) {
    const ctx = document.getElementById('shapChart');
    if (!ctx) return;

    // Destroy existing SHAP chart if any
    if (currentShapChart) {
        currentShapChart.destroy();
    }

    const features = Object.keys(featureImportances);
    const importances = features.map(f => featureImportances[f].importance);

    currentShapChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: features,
            datasets: [{
                label: 'SHAP Feature Importance',
                data: importances,
                backgroundColor: importances.map(imp =>
                    imp > 0 ? '#4CAF50' : '#F44336'
                ),
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const feature = context.label;
                            const direction = context.parsed.x > 0 ? 'increases' : 'decreases';
                            return `This feature ${direction} similarity`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Feature Importance'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Audio Features'
                    }
                }
            }
        }
    });
}

let currentShapChart = null; // Store reference to SHAP chart for cleanup

function updateGifVisibility() {
    const hasResults = resultsDiv.innerHTML.trim() !== '';
    const hasRecommendations = recsDiv.innerHTML.trim() !== '';
    const modalVisible = xaiModal.style.display === 'block';

    if (hasResults || hasRecommendations || modalVisible) {
        lottieGif.style.display = 'none';
    } else {
        lottieGif.style.display = 'block';
    }
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
    updateGifVisibility();

    fetch(`http://localhost:5000/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                resultsDiv.innerHTML = `<h2>Search Results</h2><p>Error: ${data.error}</p>`;
                updateGifVisibility();
                return;
            }

            resultsDiv.innerHTML = '<h2>🔍 Search Results</h2>';
            if (data.results.length === 0) {
                resultsDiv.innerHTML += '<p>No songs found. Try a different search.</p>';
                updateGifVisibility();
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
                        <div class="song-actions">
                            <button class="play-btn" onclick="playSong('${song.audio_url}', '${song.track_name}', this)">▶️ Play</button>
                            <button class="xai-btn" onclick="showSearchResultExplanation('${song.track_id}', '${song.track_name}', '${query}')">🤖 Why?</button>
                        </div>
                    </div>
                `;
                div.addEventListener('click', () => getRecommendations(song.track_id, song.track_name));
                resultsDiv.appendChild(div);
            });
            updateGifVisibility();
        })
        .catch(err => {
            resultsDiv.innerHTML = '<h2>Search Results</h2><p>Error loading results.</p>';
            console.error(err);
            updateGifVisibility();
        });
});

function getRecommendations(trackId, trackName) {
    recsDiv.innerHTML = `<h2>🎶 Recommendations based on "${trackName}"</h2><p>Loading...</p>`;
    updateGifVisibility();

    fetch('http://localhost:5000/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                recsDiv.innerHTML = `<h2>Recommendations</h2><p>Error: ${data.error}</p>`;
                updateGifVisibility();
                return;
            }

            recsDiv.innerHTML = `<h2>🎶 Recommendations based on "${trackName}"</h2>`;
            if (data.recommendations.length === 0) {
                recsDiv.innerHTML += '<p>No recommendations found.</p>';
                updateGifVisibility();
                return;
            }

            data.recommendations.forEach(song => {
                // Store recommendation data for XAI
                currentRecommendations[song.track_id] = song;

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
                        <div class="song-actions">
                            <button class="play-btn" onclick="playSong('${song.audio_url}', '${song.track_name}', this)">▶️ Play</button>
                            <button class="xai-btn" onclick="showXAIModal('${song.track_id}', '${song.track_name}', '${song.primary_artist_name}', '${trackName}')">🤖 Why?</button>
                        </div>
                    </div>
                `;
                recsDiv.appendChild(div);
            });
            updateGifVisibility();
        })
        .catch(err => {
            recsDiv.innerHTML = '<h2>Recommendations</h2><p>Error loading recommendations.</p>';
            console.error(err);
            updateGifVisibility();
        });
}

// Close modal when clicking outside of it
window.onclick = function (event) {
    if (event.target === xaiModal) {
        closeXAIModal();
    }
}

// Search button event listener
searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    resultsDiv.innerHTML = '<h2>🔍 Search Results</h2><p>Loading...</p>';
    recsDiv.innerHTML = '';
    updateGifVisibility();

    fetch(`http://localhost:5000/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                resultsDiv.innerHTML = `<h2>Search Results</h2><p>Error: ${data.error}</p>`;
                updateGifVisibility();
                return;
            }

            resultsDiv.innerHTML = '<h2>🔍 Search Results</h2>';
            if (data.results.length === 0) {
                resultsDiv.innerHTML += '<p>No songs found. Try a different search.</p>';
                updateGifVisibility();
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
                        <div class="song-actions">
                            <button class="play-btn" onclick="playSong('${song.audio_url}', '${song.track_name}', this)">▶️ Play</button>
                            <button class="xai-btn" onclick="showSearchResultExplanation('${song.track_id}', '${song.track_name}', '${query}')">🤖 Why?</button>
                        </div>
                    </div>
                `;
                div.addEventListener('click', () => getRecommendations(song.track_id, song.track_name));
                resultsDiv.appendChild(div);
            });
            updateGifVisibility();
        })
        .catch(err => {
            resultsDiv.innerHTML = '<h2>Search Results</h2><p>Error loading results.</p>';
            console.error(err);
            updateGifVisibility();
        });
});

// Add Enter key support for search input
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        searchBtn.click();
    }
});