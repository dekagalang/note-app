const API_HOST = 'https://note-app-production-992a.up.railway.app';
const API_BASE_URL = `${API_HOST}/api`;

const getConfig = () => ({
  SERVER_BASE_URL: API_HOST,
  API_BASE_URL,
  IS_DOCKER: false,
});

export default getConfig();
