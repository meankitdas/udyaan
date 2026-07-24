const getApiUrl = () => {
    return process.env.REACT_APP_API_URL || 'http://localhost:8000';
    // return process.env.REACT_APP_API_URL || 'https://dqfmykxohfjc3ur5eoi4uvkfly0ghmip.lambda-url.ap-south-1.on.aws';

};

export const API_BASE_URL = getApiUrl();
