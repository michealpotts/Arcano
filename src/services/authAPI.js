import apiClient from "./apiClient";

export const authAPI = {
  async getSignMessage(walletAddress) {
    const res = await apiClient.post("/auth/sign-message", { walletAddress });
    return res.data;
  },

  async login(walletAddress, message, signature,timestamp) {
    const payload = { walletAddress, message, signature , timestamp};
    const res = await apiClient.post("/auth/login", payload);
    // Backend returns { success, data: { token, profile }, message }
    return res.data?.data || res.data;
  },

  async verify() {
    const res = await apiClient.get("/auth/verify");
    return res.data;
  },
};

export const profileAPI = {
  async getProfile(playerId) {
    const res = await apiClient.get(`/profile/${playerId}`);
    return res.data;
  },

  async updateNickname(playerId, nickname) {
    const res = await apiClient.put(`/profile/${playerId}/nickname`, { nickname });
    return res.data;
  },

  async uploadProfilePicture(playerId, formData) {
    const res = await apiClient.post(`/profile/${playerId}/picture`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};

export default authAPI;
