# Smart Music Recommendation System

## Overview

This is an intelligent music recommendation system that uses machine learning to suggest songs based on audio features and user preferences. The system analyzes musical characteristics like valence, danceability, energy, and more to provide personalized recommendations. It's built with a content-based filtering approach using Spotify's extensive music dataset.

## What This Model Does

The Smart Music Recommendation System performs the following key functions:

1. **Song Search**: Allows users to search for songs by name from a vast database of over 32,000 tracks
2. **Content-Based Recommendations**: Generates personalized song recommendations based on audio features rather than user behavior
3. **Real-Time Processing**: Provides instant search results and recommendations through a RESTful API
4. **Interactive UI**: Features a modern, responsive web interface with smooth animations and floating elements

## Data Source

The system uses Spotify's comprehensive music dataset, which includes:

- **Songs Dataset** (`songs_with_audio_feature.csv`): Contains 32,644+ songs with detailed audio features
- **Albums Dataset** (`albums.csv`): Album information and metadata
- **Artists Dataset** (`artists.csv`): Artist details including popularity and follower counts

### Audio Features Used
The recommendation model analyzes the following musical characteristics:
- **Valence**: Musical positiveness (0.0 to 1.0)
- **Acousticness**: Acoustic vs electronic sound
- **Danceability**: Suitability for dancing
- **Energy**: Intensity and activity level
- **Instrumentalness**: Presence of vocals
- **Liveness**: Live performance detection
- **Loudness**: Overall volume in decibels
- **Speechiness**: Presence of spoken words
- **Tempo**: Beats per minute
- **Key & Mode**: Musical key and major/minor mode
- **Explicit Content**: Presence of explicit lyrics
- **Popularity**: Song and artist popularity metrics
- **Followers**: Artist follower count

## Machine Learning Model

### Algorithm Used
- **Nearest Neighbors** with **Cosine Similarity**
- **Library**: scikit-learn (sklearn.neighbors.NearestNeighbors)

### Model Architecture
1. **Feature Scaling**: StandardScaler normalizes all audio features
2. **Similarity Calculation**: Cosine similarity measures the angle between feature vectors
3. **Recommendation Generation**: Finds the 9 most similar songs to the input track
4. **Content-Based Filtering**: Recommendations based on musical characteristics, not user history

### Training Process
- Data preprocessing and feature engineering
- Merging multiple datasets (songs, albums, artists)
- Handling missing values and duplicates
- Feature scaling for optimal model performance
- Model training and serialization using joblib

## Frontend Integration

The system features a modern, responsive web interface built with:

- **HTML5**: Semantic structure and accessibility
- **CSS3**: Custom styling with gradients, animations, and responsive design
- **JavaScript**: Dynamic interactions and API communication
- **Lottie Animations**: Floating animation elements for enhanced user experience

### Key UI Features
- Floating Lottie animation above the main card
- Responsive design for all screen sizes
- Smooth hover effects and transitions
- Real-time search with instant results
- Interactive song recommendations with play buttons

## Screenshots

### Screenshot 1: Main Interface
![Main Interface](screenshot1.png)
*The main dashboard showing the search interface with floating animation*

### Screenshot 2: Search Results and Recommendations
![Search Results](screenshot2.png)
*Search results and personalized recommendations based on selected song*

## Setup and Installation

### Prerequisites
- Python 3.7 or higher
- pip package manager

### Installation Steps

1. **Clone or download the project**
   ```bash
   cd /path/to/project
   ```

2. **Install Python dependencies**
   ```bash
   pip install pandas numpy scikit-learn flask flask-cors joblib
   ```

3. **Prepare the dataset**
   - Place the following CSV files in the `Data Set/` folder:
     - `songs_with_audio_feature.csv`
     - `albums.csv`
     - `artists.csv`

4. **Train the recommendation model**
   ```bash
   python train_model.py
   ```
   This will generate:
   - `music_recommender.pkl` (trained model)
   - `scaler.pkl` (feature scaler)
   - `songs_df.pkl` (processed dataset)

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:5000`
   - Or open `static/index.html` directly in your browser

## Usage Guide

1. **Search for Songs**: Enter a song name in the search box
2. **Browse Results**: Click "Search" to see matching songs
3. **Get Recommendations**: Click on any song to receive 9 personalized recommendations
4. **Explore Music**: Use the example tags for quick searches

## API Documentation

### Endpoints

#### GET /search?q=<query>
Search for songs by name
- **Parameters**: `q` (search query)
- **Response**: JSON with search results

#### POST /recommend
Get recommendations for a specific track
- **Body**: `{"track_id": "spotify_track_id"}`
- **Response**: JSON with 9 recommended songs

#### GET /
Serve the main web interface

## Technologies Used

### Backend
- **Python 3.7+**
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **scikit-learn**: Machine learning library
- **pandas**: Data manipulation
- **joblib**: Model serialization

### Frontend
- **HTML5**: Structure
- **CSS3**: Styling and animations
- **JavaScript (ES6+)**: Interactivity
- **Lottie Web Components**: Animations

### Data Processing
- **StandardScaler**: Feature normalization
- **NearestNeighbors**: Recommendation algorithm
- **Cosine Similarity**: Distance metric

## Project Structure

```
music-recommender/
├── app.py                    # Flask backend server
├── train_model.py           # Model training script
├── music_recommender.pkl    # Trained ML model
├── scaler.pkl              # Feature scaler
├── songs_df.pkl            # Processed dataset
├── README.md               # This file
├── static/
│   ├── index.html          # Main web interface
│   ├── style.css           # CSS styling
│   └── script.js           # Frontend JavaScript
└── Data Set/
    ├── songs_with_audio_feature.csv
    ├── albums.csv
    └── artists.csv
```

## Future Enhancements

- User-based collaborative filtering
- Hybrid recommendation system
- Real-time audio feature extraction
- Integration with Spotify API
- User preference learning
- Playlist generation
- Mobile app development

## Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Improving the recommendation algorithm
- Enhancing the user interface

## License

This project is open-source and available under the MIT License.