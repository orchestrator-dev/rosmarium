import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp-up
    { duration: '1m', target: 20 },  // Steady load
    { duration: '30s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test GraphQL endpoint
  const res = http.post(`${BASE_URL}/graphql`, JSON.stringify({
    query: `
      query {
        contentTypes {
          name
          description
        }
      }
    `,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has no errors': (r) => !r.json().errors,
  });

  sleep(1);
}
