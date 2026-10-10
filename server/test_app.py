import unittest
from unittest.mock import patch
import json
import base64
import io
import os
from PIL import Image

# Import Flask app and helpers from app
import app as server_app

def create_test_image_b64(width=100, height=100, fmt='JPEG', color='green'):
    img = Image.new('RGB', (width, height), color=color)
    buffer = io.BytesIO()
    img.save(buffer, format=fmt)
    raw_bytes = buffer.getvalue()
    b64_str = base64.b64encode(raw_bytes).decode('utf-8')
    mime = 'image/jpeg' if fmt.upper() == 'JPEG' else 'image/png'
    return f"data:{mime};base64,{b64_str}"

class AgroSenseBackendTests(unittest.TestCase):
    def setUp(self):
        server_app.app.config['TESTING'] = True
        self.client = server_app.app.test_client()

    def test_health_endpoint(self):
        """Verify health endpoint returns 200 and expected schema"""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('status'), 'healthy')
        self.assertIn('ai', data)

    def test_disease_severity_determination(self):
        """Verify disease severity is decoupled from confidence and uses pathology rules"""
        # Late blight should be critical or high regardless of confidence
        sev_late_blight = server_app.determine_disease_severity('Tomato Late Blight')
        self.assertIn(sev_late_blight, ['critical', 'high'])

        # Healthy plant should have low severity
        sev_healthy = server_app.determine_disease_severity('Tomato Healthy')
        self.assertEqual(sev_healthy, 'low')

        # Unknown condition should return uncertain
        sev_unknown = server_app.determine_disease_severity('Completely Unknown Condition XYZ')
        self.assertEqual(sev_unknown, 'uncertain')

    def test_confidence_validation(self):
        """Verify confidence values are properly validated and bounded"""
        val1, valid1 = server_app.validate_confidence(0.95)
        self.assertTrue(valid1)
        self.assertEqual(val1, 95)

        val2, valid2 = server_app.validate_confidence(85)
        self.assertTrue(valid2)
        self.assertEqual(val2, 85)

        val3, valid3 = server_app.validate_confidence(150)
        self.assertFalse(valid3)
        self.assertIsNone(val3)

        val4, valid4 = server_app.validate_confidence(-10)
        self.assertFalse(valid4)
        self.assertIsNone(val4)

        _, valid5 = server_app.validate_confidence('invalid')
        self.assertFalse(valid5)

    def test_malformed_base64_rejection(self):
        """Verify malformed base64 payload is rejected with 400"""
        response = self.client.post('/api/analyze', 
            data=json.dumps({'image': 'data:image/jpeg;base64,not-valid-base64!@#$'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_unsupported_image_content_rejection(self):
        """Verify non-image bytes passed with image data URI header are rejected"""
        fake_b64 = base64.b64encode(b"This is just plain text, not image bytes").decode('utf-8')
        response = self.client.post('/api/analyze',
            data=json.dumps({'image': f'data:image/jpeg;base64,{fake_b64}'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_invalid_image_dimensions_rejection(self):
        """Verify image decoder detects oversized dimensions"""
        img_b64 = create_test_image_b64(width=5000, height=100)
        mime, img_bytes, err, status = server_app.validate_and_decode_image(img_b64)
        self.assertIsNone(img_bytes)
        self.assertIn('exceed maximum allowed', err)
        self.assertEqual(status, 400)

    def test_missing_image_payload(self):
        """Verify missing image payload returns 400"""
        response = self.client.post('/api/analyze',
            data=json.dumps({}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    @patch('app.analyze_with_gemini')
    def test_valid_image_analysis_successful(self, mock_gemini):
        """Verify valid image produces normalized output with decoupled severity"""
        mock_gemini.return_value = {
            'plant_name': 'Tomato',
            'disease': 'Early Blight',
            'confidence': 88,
            'severity': 'medium',
            'description': 'Target-like concentric rings on foliage.',
            'remedies': [
                {'step': 1, 'action': 'Prune lower diseased foliage', 'timeframe': 'Immediate'}
            ],
            'prescribed_care': {'immediate_actions': ['Isolate plant']}
        }

        test_img = create_test_image_b64(width=200, height=200)
        
        # Force provider order to use gemini
        with patch.dict(os.environ, {'PROVIDER_ORDER': 'gemini'}):
            response = self.client.post('/api/analyze',
                data=json.dumps({'image': test_img}),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data.get('plant_name'), 'Tomato')
            self.assertEqual(data.get('disease'), 'Early Blight')
            self.assertEqual(data.get('confidence'), 88)
            self.assertEqual(data.get('severity'), 'medium')
            # Verify no remedy has fabricated effectiveness
            for r in data.get('remedies', []):
                self.assertNotIn('effectiveness', r)

    def test_weather_fallback_labeling(self):
        """Verify weather fallback returns transparent is_fallback flag on failure"""
        with patch('requests.get', side_effect=Exception("API connection timeout")):
            response = self.client.get('/api/environment/weather?location=Rajkot,%20Gujarat')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data.get('is_fallback'))
            self.assertTrue(data.get('is_estimated'))
            self.assertIn('Rajkot', data.get('location'))

    def test_soil_fallback_labeling(self):
        """Verify soil endpoint returns explicit baseline flag when API unavailable"""
        with patch('requests.post', side_effect=Exception("Soil service unreachable")):
            response = self.client.get('/api/environment/soil')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data.get('is_fallback'))
            self.assertIn('source', data)

    def test_watering_schedule_indoor_plant_rain_handling(self):
        """Verify outdoor rainfall does not defer watering for indoor container plants"""
        weather_payload = {
            'temperature': 28,
            'humidity': 60,
            'rainfall': 15, # heavy rain
            'description': 'Heavy rain'
        }
        soil_payload = {'moisture': '35%', 'texture': 'Loam', 'ph': 6.5}
        
        # 1. Outdoor plant: rain should delay watering
        outdoor_res = server_app.calculate_watering_schedule_backend(
            weather_payload, soil_payload, 'Tomato', 'Healthy', 'normal', 'outdoor'
        )
        self.assertEqual(outdoor_res.get('today', {}).get('status'), 'delay')
        
        # 2. Indoor plant: outdoor rain should NOT delay watering
        indoor_res = server_app.calculate_watering_schedule_backend(
            weather_payload, soil_payload, 'Tomato', 'Healthy', 'normal', 'indoor'
        )
        self.assertNotEqual(indoor_res.get('today', {}).get('status'), 'delay')

    def test_security_headers_present(self):
        """Verify security headers are attached to responses"""
        response = self.client.get('/api/health')
        headers = response.headers
        self.assertIn('X-Content-Type-Options', headers)
        self.assertEqual(headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertIn('X-Frame-Options', headers)

    def test_cors_origin_handling(self):
        """Verify CORS allows valid origin and returns headers"""
        response = self.client.get('/api/health', headers={'Origin': 'http://localhost:5173'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')

    def test_error_response_does_not_leak_secrets(self):
        """Verify error handler does not expose internal secrets or stack traces"""
        response = self.client.post('/api/analyze',
            data="not json",
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        text = response.get_data(as_text=True)
        # Ensure no secret keywords are dumped
        self.assertNotIn('GEMINI_API_KEY', text)
        self.assertNotIn('HUGGINGFACE_API_KEY', text)
        self.assertNotIn('SECRET_KEY', text)

if __name__ == '__main__':
    unittest.main()
