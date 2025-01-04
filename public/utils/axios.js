// Placeholder for future use with a login-based system

// import env from "@/env.js"
// import axios from 'axios'
// import { useTokens } from '@/composables/useTokens.js'
// const { setTokens, unsetTokens } = useTokens();

// var config = {
//     baseURL: env.API_URL,
//     headers: {
//         Accept: "application/json",
//     },
// }

// const configuredAxios = axios.create(config);

// //Request
// configuredAxios.interceptors.request.use(
//     config => {
//         let token = localStorage.getItem('token');

//         if (token) {
//             config.headers = {
//                 'Authorization': `Bearer ${token}`
//             }
//         }
//         return config;
//     },
//     error => Promise.reject(error)
// );

// //Analyze Responses
// configuredAxios.interceptors.response.use(
//     response => {
//         const authToken = response.headers['auth-token'];
//         const authTokenDecoded = response.headers['auth-token-decoded'];

//         if (authToken) {
//             localStorage.setItem('token', authToken);
//             if (authTokenDecoded) {
//                 try {
//                     // Attempt to parse the auth-token-decoded header if it's not undefined
//                     const decoded = JSON.parse(authTokenDecoded);
//                     localStorage.setItem('tokenDecoded', authTokenDecoded);
//                     setTokens(authToken, decoded);
//                 } catch (error) {
//                     console.error("Failed to parse auth-token-decoded from headers:", error);
//                     // Handle the error appropriately
//                 }
//             } else {
//                 console.error("auth-token-decoded header is missing or undefined");
//                 // Handle the missing header appropriately
//             }
//         }
//         return Promise.resolve(response);
//     },
//     error => {
//         console.log('Error', error)
//         if (error?.response?.status === 403 || error?.response?.status === 401) {
//             unsetTokens();
//             // Consider redirecting to login or showing a message instead of reloading
//             // window.location.reload(true);
//         }
//         return Promise.reject(error);
//     }
// );
// export default configuredAxios;
