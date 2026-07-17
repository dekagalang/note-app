const API_HOST = 'https://fulfilling-acceptance-production-be7d.up.railway.app';
const API_BASE_URL = `${API_HOST}/api`;

const getConfig = () => ({
  SERVER_BASE_URL: API_HOST,
  API_BASE_URL,
  IS_DOCKER: false,
});

export default getConfig();
