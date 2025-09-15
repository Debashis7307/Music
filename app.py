from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
from lime.lime_tabular import LimeTabularExplainer
import shap

app = Flask(__name__)
CORS(app)

# Load model and data
print("Loading model and data...")
nn = joblib.load('music_recommender.pkl')
scaler = joblib.load('scaler.pkl')
songs_df = pd.read_pickle('songs_df.pkl')
print(f"Loaded {len(songs_df)} songs")
print("Sample song:", songs_df.iloc[0]['track_name'])

features = ['valence', 'acousticness', 'danceability', 'energy', 'instrumentalness', 'liveness', 'loudness', 'speechiness', 'tempo', 'key', 'mode', 'explicit', 'popularity_x', 'followers', 'popularity_y']

# Mood-based search criteria
mood_features = {
    'happy': {'valence': (0.6, 1.0)},
    'sad': {'valence': (0.0, 0.4)},
    'energetic': {'energy': (0.6, 1.0)},
    'calm': {'energy': (0.0, 0.4)},
    'dance': {'danceability': (0.6, 1.0)},
    'acoustic': {'acousticness': (0.6, 1.0)},
    'pop': {'popularity_x': (50, 100)},
    'jazz': {'genres': 'jazz'},
    'rock': {'genres': 'rock'},
    'classical': {'genres': 'classical'},
    'love': {'valence': (0.5, 1.0), 'energy': (0.3, 0.7)},
    'romantic': {'valence': (0.5, 1.0), 'danceability': (0.3, 0.7)},
    'party': {'energy': (0.7, 1.0), 'danceability': (0.6, 1.0)},
    'chill': {'energy': (0.0, 0.4), 'acousticness': (0.5, 1.0)},
    'workout': {'energy': (0.8, 1.0), 'tempo': (120, 200)},
}

# Prepare data for LIME and SHAP
X = scaler.transform(songs_df[features].values)
print(f"Prepared {X.shape[0]} samples for explanations")

# Initialize LIME explainer
lime_explainer = LimeTabularExplainer(
    X,
    feature_names=features,
    class_names=['dissimilar', 'similar'],
    mode='classification',
    discretize_continuous=True
)

# Initialize SHAP explainer (using KernelExplainer for non-tree models)
# Sample a subset for SHAP to speed up
sample_size = min(100, len(X))
sample_indices = np.random.choice(len(X), sample_size, replace=False)
X_sample = X[sample_indices]
shap_explainer = shap.KernelExplainer(lambda x: nn.kneighbors(x)[0][:, 0], X_sample)

# Feature descriptions for XAI explanations
feature_descriptions = {
    'valence': 'Musical positiveness (happy vs sad)',
    'acousticness': 'Whether the track is acoustic',
    'danceability': 'How suitable the track is for dancing',
    'energy': 'Intensity and powerful feeling',
    'instrumentalness': 'Whether the track contains vocals',
    'liveness': 'Presence of audience in recording',
    'loudness': 'Overall loudness in decibels',
    'speechiness': 'Presence of spoken words',
    'tempo': 'Speed or pace of the track (BPM)',
    'key': 'Musical key of the track',
    'mode': 'Musical mode (major or minor)',
    'explicit': 'Whether the track has explicit lyrics',
    'popularity_x': 'Song popularity score',
    'followers': 'Artist follower count',
    'popularity_y': 'Artist popularity score'
}

def calculate_feature_similarity(song1_features, song2_features, feature_names):
    """Calculate similarity for each feature between two songs"""
    similarities = {}
    for i, feature in enumerate(feature_names):
        # Calculate absolute difference and convert to similarity (0-1 scale)
        diff = abs(song1_features[i] - song2_features[i])
        # Normalize difference to similarity score
        if feature in ['key', 'mode', 'explicit']:
            # Categorical features
            similarities[feature] = 1.0 if diff < 0.1 else 0.0
        else:
            # Continuous features - use inverse of normalized difference
            max_diff = 2.0  # Assuming standardized features range roughly -2 to 2
            similarity = max(0, 1 - (diff / max_diff))
            similarities[feature] = min(1.0, similarity)
    return similarities

def generate_explanation(original_song, recommended_song, similarities, overall_similarity, original_features=None, recommended_features=None):
    """Generate human-readable explanation for recommendation"""
    # Find top contributing features
    sorted_similarities = sorted(similarities.items(), key=lambda x: x[1], reverse=True)
    top_features = sorted_similarities[:5]
    
    explanation = {
        'overall_similarity': round(overall_similarity * 100, 1),
        'top_matching_features': [],
        'feature_comparison': {},
        'reasoning': []
    }
    
    # Add top matching features
    for feature, similarity in top_features:
        if similarity > 0.7:  # High similarity threshold
            explanation['top_matching_features'].append({
                'feature': feature,
                'description': feature_descriptions[feature],
                'similarity': round(similarity * 100, 1)
            })
    
    # Add detailed feature comparison
    for feature in features:
        orig_val = original_song[feature].iloc[0] if hasattr(original_song[feature], 'iloc') else original_song[feature]
        rec_val = recommended_song[feature].iloc[0] if hasattr(recommended_song[feature], 'iloc') else recommended_song[feature]
        
        explanation['feature_comparison'][feature] = {
            'original': round(float(orig_val), 3),
            'recommended': round(float(rec_val), 3),
            'similarity': round(similarities[feature] * 100, 1),
            'description': feature_descriptions[feature]
        }
    
    # Generate reasoning text
    if explanation['overall_similarity'] > 80:
        explanation['reasoning'].append("This song is very similar to your selected track.")
    elif explanation['overall_similarity'] > 60:
        explanation['reasoning'].append("This song shares several key characteristics with your selected track.")
    else:
        explanation['reasoning'].append("This song has some similar elements to your selected track.")
    
    # Add specific feature reasoning
    high_sim_features = [f for f, s in similarities.items() if s > 0.8]
    if high_sim_features:
        feature_names = [feature_descriptions[f].lower() for f in high_sim_features[:3]]
        explanation['reasoning'].append(f"Both songs have very similar {', '.join(feature_names)}.")

    # Add LIME and SHAP explanations if features provided
    # Temporarily disabled to avoid connection issues
    # if original_features is not None and recommended_features is not None:
    #     explanation['lime_explanation'] = generate_lime_explanation(original_features, recommended_features)
    #     explanation['shap_explanation'] = generate_shap_explanation(original_features, recommended_features)
    explanation['lime_explanation'] = {'available': False, 'error': 'Disabled for performance'}
    explanation['shap_explanation'] = {'available': False, 'error': 'Disabled for performance'}

    return explanation

def generate_lime_explanation(original_features, recommended_features):
    """Generate LIME explanation for the recommendation"""
    try:
        # Create a simple classifier: predict if distance is small (similar)
        def predict_similarity(x):
            distances = nn.kneighbors(x)[0][:, 0]
            return (distances < 0.5).astype(int)  # threshold for similarity

        # Explain the recommended song's features
        exp = lime_explainer.explain_instance(
            recommended_features,
            predict_similarity,
            num_features=5,
            num_samples=100
        )

        lime_data = {
            'available': True,
            'explanation_score': exp.score,
            'top_features': []
        }

        for feature, weight in exp.as_list():
            direction = 'positive' if weight > 0 else 'negative'
            lime_data['top_features'].append({
                'feature': feature,
                'importance': weight,
                'direction': direction,
                'description': feature_descriptions.get(feature.split(' ')[0], feature)  # handle discretized features
            })

        return lime_data
    except Exception as e:
        print(f"LIME explanation failed: {e}")
        return {'available': False, 'error': str(e)}

def generate_shap_explanation(original_features, recommended_features):
    """Generate SHAP explanation for the recommendation"""
    try:
        # Use KernelExplainer to explain the distance
        shap_values = shap_explainer.shap_values(recommended_features.reshape(1, -1))

        shap_data = {
            'available': True,
            'feature_importances': {}
        }

        for i, feature in enumerate(features):
            shap_data['feature_importances'][feature] = {
                'importance': float(shap_values[0][i]),
                'description': feature_descriptions[feature]
            }

        return shap_data
    except Exception as e:
        print(f"SHAP explanation failed: {e}")
        return {'available': False, 'error': str(e)}

@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.json
    track_id = data.get('track_id')
    print(f"Recommend request for track_id: {track_id}")
    if not track_id:
        print("No track_id provided")
        return jsonify({'error': 'track_id required'}), 400

    # Find the song
    song = songs_df[songs_df['track_id'] == track_id]
    if song.empty:
        print(f"Track {track_id} not found")
        return jsonify({'error': 'Track not found'}), 404

    print(f"Found song: {song.iloc[0]['track_name']}")

    # Get features
    song_features = song[features].values
    scaled = scaler.transform(song_features)

    # Find neighbors
    distances, indices = nn.kneighbors(scaled)

    # Get recommended songs with XAI explanations
    recs = songs_df.iloc[indices[0][1:6]]  # exclude self, limit to 5
    print(f"Recommendations: {len(recs)} songs")
    
    recommendations = []
    for i, (_, rec_song) in enumerate(recs.iterrows()):
        # Get scaled features for both songs
        rec_features = rec_song[features].values.reshape(1, -1)
        rec_scaled = scaler.transform(rec_features)
        
        # Calculate feature similarities
        similarities = calculate_feature_similarity(
            scaled[0], rec_scaled[0], features
        )
        
        # Calculate overall similarity (inverse of distance)
        overall_similarity = 1 / (1 + distances[0][i + 1])
        
        # Generate explanation
        explanation = generate_explanation(
            song, rec_song, similarities, overall_similarity, scaled[0], rec_scaled[0]
        )
        
        # Create recommendation object
        rec_data = {
            'track_id': rec_song['track_id'],
            'track_name': rec_song['track_name'],
            'primary_artist_name': rec_song['primary_artist_name'],
            'album_name': rec_song['album_name'],
            'album_cover_64x64': rec_song['album_cover_64x64'],
            'genres': rec_song['genres'],
            'audio_url': f'https://example.com/audio/{rec_song["track_id"]}.mp3',
            'xai_explanation': explanation
        }
        recommendations.append(rec_data)

    return jsonify({'recommendations': recommendations})

@app.route('/explain/<track_id>/<rec_track_id>', methods=['GET'])
def explain_recommendation(track_id, rec_track_id):
    """Get detailed explanation for a specific recommendation"""
    # Find both songs
    original_song = songs_df[songs_df['track_id'] == track_id]
    recommended_song = songs_df[songs_df['track_id'] == rec_track_id]

    if original_song.empty or recommended_song.empty:
        return jsonify({'error': 'One or both tracks not found'}), 404

    # Get features and calculate similarities
    orig_features = scaler.transform(original_song[features].values)
    rec_features = scaler.transform(recommended_song[features].values)

    similarities = calculate_feature_similarity(
        orig_features[0], rec_features[0], features
    )

    # Calculate overall similarity
    distances = nn.kneighbors(orig_features)[0]
    overall_similarity = 1 / (1 + np.linalg.norm(orig_features[0] - rec_features[0]))

    explanation = generate_explanation(
        original_song, recommended_song, similarities, overall_similarity, orig_features[0], rec_features[0]
    )

    return jsonify({
        'original_song': {
            'track_name': original_song.iloc[0]['track_name'],
            'artist': original_song.iloc[0]['primary_artist_name']
        },
        'recommended_song': {
            'track_name': recommended_song.iloc[0]['track_name'],
            'artist': recommended_song.iloc[0]['primary_artist_name']
        },
        'explanation': explanation
    })

@app.route('/search_explain/<track_id>/<search_query>', methods=['GET'])
def explain_search_result(track_id, search_query):
    """Get detailed explanation for why a song appears in search results"""
    # Find the song
    song = songs_df[songs_df['track_id'] == track_id]
    if song.empty:
        return jsonify({'error': 'Track not found'}), 404

    search_query_lower = search_query.lower()
    is_mood = search_query_lower in mood_features

    explanation = {
        'overall_similarity': 0,
        'top_matching_features': [],
        'feature_comparison': {},
        'reasoning': [],
        'lime_explanation': {'available': False, 'error': 'Initializing...'},
        'shap_explanation': {'available': False, 'error': 'Initializing...'}
    }

    if is_mood:
        # Mood-based search explanation with real AI analysis
        mood_criteria = mood_features[search_query_lower]
        song_features = song[features].values[0]

        # Create a "virtual" song representing the mood
        virtual_song_features = np.zeros(len(features))
        for feature, value in mood_criteria.items():
            if isinstance(value, tuple):
                # Use the midpoint of the range as the target
                min_val, max_val = value
                virtual_song_features[features.index(feature)] = (min_val + max_val) / 2

        # Scale both songs
        song_scaled = scaler.transform(song_features.reshape(1, -1))[0]
        virtual_scaled = scaler.transform(virtual_song_features.reshape(1, -1))[0]

        # Calculate similarity using the same method as recommendations
        similarities = calculate_feature_similarity(song_scaled, virtual_scaled, features)

        # Calculate overall similarity
        distances = nn.kneighbors(song_scaled.reshape(1, -1))[0]
        overall_similarity = 1 / (1 + distances[0][0])  # Distance to itself would be 0, so use first neighbor

        explanation['overall_similarity'] = round(overall_similarity * 100, 1)

        # Sort similarities for top features
        sorted_similarities = sorted(similarities.items(), key=lambda x: x[1], reverse=True)
        top_features = sorted_similarities[:5]

        explanation['top_matching_features'] = []
        for feature, similarity in top_features:
            if similarity > 0.7:
                explanation['top_matching_features'].append({
                    'feature': feature,
                    'description': feature_descriptions[feature],
                    'similarity': round(similarity * 100, 1)
                })

        # Create feature comparison
        for feature in features:
            song_val = song_features[features.index(feature)]
            virtual_val = virtual_song_features[features.index(feature)]
            similarity = similarities[feature]

            explanation['feature_comparison'][feature] = {
                'original': round(float(virtual_val), 3),
                'recommended': round(float(song_val), 3),
                'similarity': round(similarity * 100, 1),
                'description': feature_descriptions[feature]
            }

        # Generate LIME explanation for this song vs mood
        try:
            def predict_mood_match(x):
                # Predict how well songs match the mood
                distances = nn.kneighbors(x)[0][:, 0]
                # For mood matching, lower distance means better match
                return (distances < 0.5).astype(int)

            exp = lime_explainer.explain_instance(
                song_scaled,
                predict_mood_match,
                num_features=5,
                num_samples=100
            )

            explanation['lime_explanation'] = {
                'available': True,
                'explanation_score': round(float(exp.score), 3),
                'top_features': []
            }

            for feature, weight in exp.as_list():
                direction = 'positive' if weight > 0 else 'negative'
                explanation['lime_explanation']['top_features'].append({
                    'feature': feature,
                    'importance': round(float(weight), 3),
                    'direction': direction,
                    'description': feature_descriptions.get(feature.split(' ')[0], feature)
                })

        except Exception as e:
            explanation['lime_explanation'] = {'available': False, 'error': str(e)}

        # Generate SHAP explanation
        try:
            shap_values = shap_explainer.shap_values(song_scaled.reshape(1, -1))

            explanation['shap_explanation'] = {
                'available': True,
                'feature_importances': {}
            }

            for i, feature in enumerate(features):
                explanation['shap_explanation']['feature_importances'][feature] = {
                    'importance': round(float(shap_values[0][i]), 3),
                    'description': feature_descriptions[feature]
                }

        except Exception as e:
            explanation['shap_explanation'] = {'available': False, 'error': str(e)}

        explanation['reasoning'] = [
            f'This song matches the "{search_query}" mood with {explanation["overall_similarity"]}% similarity based on AI analysis.',
            f'The song has {len([f for f, s in similarities.items() if s > 0.8])} out of {len(features)} features that strongly match the mood.',
            'AI analysis shows the most influential features contributing to this mood match.'
        ]

    else:
        # Regular search explanation
        song_title = song['track_name'].values[0].lower()
        if search_query_lower in song_title:
            explanation['overall_similarity'] = 100
            explanation['reasoning'] = [
                f'This song appears because its title contains "{search_query}".',
                f'Song title: "{song["track_name"].values[0]}"',
                'The search looks for songs with matching words in their track names.'
            ]
        else:
            explanation['overall_similarity'] = 0
            explanation['reasoning'] = [
                f'This song does not contain "{search_query}" in its title.',
                f'Song title: "{song["track_name"].values[0]}"',
                'Try searching for different keywords.'
            ]

    return jsonify({
        'search_query': search_query,
        'song': {
            'track_name': song['track_name'].values[0],
            'artist': song['primary_artist_name'].values[0]
        },
        'explanation': explanation
    })

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    print(f"Search query received: '{query}'")
    if not query:
        print("No query provided")
        return jsonify({'error': 'query required'}), 400

    query_lower = query.lower()

    if query_lower in mood_features:
        # Mood-based search
        criteria = mood_features[query_lower]
        # Start with all rows
        results = songs_df.copy()

        for feature, value in criteria.items():
            if isinstance(value, tuple):
                min_val, max_val = value
                results = results[(results[feature] >= min_val) & (results[feature] <= max_val)]
            else:
                # For genres, check if contains the string
                results = results[results['genres'].str.contains(value, case=False, na=False)]

        results = results.head(10)
        print(f"Found {len(results)} mood-matched results for '{query}'")
    else:
        # Simple search by track name
        results = songs_df[songs_df['track_name'].str.contains(query, case=False, na=False)].head(10)
        print(f"Found {len(results)} results for query '{query}'")

    if len(results) > 0:
        print("Sample result:", results.iloc[0]['track_name'])
        # Check for duplicates in results
        unique_tracks = results['track_id'].nunique()
        print(f"Unique tracks in results: {unique_tracks} out of {len(results)} total")
        if unique_tracks != len(results):
            print("WARNING: Duplicates found in search results!")
            # Show duplicate track_ids
            duplicates = results[results.duplicated(subset='track_id', keep=False)]
            if not duplicates.empty:
                print("Duplicate track_ids:", duplicates['track_id'].unique())

    # Add placeholder audio URL for demonstration
    search_results = results[['track_id', 'track_name', 'primary_artist_name', 'album_name', 'album_cover_64x64', 'genres']].to_dict('records')
    # Add audio_url to each result
    for result in search_results:
        result['audio_url'] = f'https://example.com/audio/{result["track_id"]}.mp3'  # Placeholder
    return jsonify({'results': search_results})

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(debug=False)