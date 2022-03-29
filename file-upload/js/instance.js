/*把axios发送请求的公共信息进行提取*/
//创建一个单独的实例,不去项目全局的或者其他的axios冲突
let instance = axios.create();
instance.defaults.baseURL = 'http://127.0.0.1:8888';
//默认是multipart/form-data格式
instance.defaults.headers['Content-Type'] = 'multipart/form-data';
instance.defaults.transformRequest = (data, headers) => {
    //兼容x-www-form-urlencoded格式的请求发送
    const contentType = headers['Content-Type'];
    if (contentType === "application/x-www-form-urlencoded") return Qs.stringify(data);
    return data;
};
//统一结果的处理
instance.interceptors.response.use(response => {
    return response.data;
},reason=>{
    //统一失败的处理
    return Promise.reject(reason)
});
