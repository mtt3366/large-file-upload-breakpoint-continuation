// 延迟函数
const delay = function delay(interval) {
    typeof interval !== "number" ? interval = 1000 : null;
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, interval);
    });
};
/* 大文件上传 */
(function () {
    let upload = document.querySelector('#upload7'),
        upload_inp = upload.querySelector('.upload_inp'),
        upload_button_select = upload.querySelector('.upload_button.select'),
        upload_progress = upload.querySelector('.upload_progress'),
        upload_progress_value = upload_progress.querySelector('.value');

    const checkIsDisable = element => {
        let classList = element.classList;
        return classList.contains('disable') || classList.contains('loading');
    };

    /**
     * 传入文件对象,返回文件生成的HASH值,后缀,buffer,以HASH值为名的新文件名
     * @param file
     * @returns {Promise<unknown>}
     */
    const changeBuffer = file => {
        return new Promise(resolve => {
            let fileReader = new FileReader();
            fileReader.readAsArrayBuffer(file);
            fileReader.onload = ev => {
                let buffer = ev.target.result,
                    spark = new SparkMD5.ArrayBuffer(),
                    HASH,
                    suffix;
                spark.append(buffer);
                HASH = spark.end();
                suffix = /\.([a-zA-Z0-9]+)$/.exec(file.name)[1];
                resolve({
                    buffer,
                    HASH,
                    suffix,
                    filename: `${HASH}.${suffix}`
                });
            };
        });
    };

    upload_inp.addEventListener('change', async function () {
        //get native file object
        let file = upload_inp.files[0];
        if (!file) return;
        //button add loading
        upload_button_select.classList.add('loading');
        //show progress
        upload_progress.style.display = 'block';

        // 获取文件的HASH
        let already = [],//已经上传过的切片的切片名
            data = null,
            {
                HASH,
                suffix
            } = await changeBuffer(file);//得到原始文件的hash和后缀

        // 获取已经上传的切片信息
        try {
            data = await instance.get('/upload_already', {
                params: {
                    HASH
                }
            });
            if (+data.code === 0) {
                already = data.fileList;
            }
        } catch (err) {}

        // 实现文件切片处理 「固定数量 & 固定大小」
        let max = 1024 * 100,//切片大小先设置100KB
            count = Math.ceil(file.size / max),//得到应该上传的切片
            index = 0,//存放切片数组的时候遍历使用
            chunks = [];//用以存放切片值
        if (count > 100) {//如果切片数量超过100,那么就只切成100个,因为切片太多的话也会影响调用接口的速度
            max = file.size / 100;
            count = 100;
        }
        while (index < count) {//循环生成切片
            //index 0 =>  0~max
            //index 1 =>  max~max*2
            //index*max ~(index+1)*max
            chunks.push({
                file: file.slice(index * max, (index + 1) * max),
                filename: `${HASH}_${index+1}.${suffix}`
            });
            index++;
        }

        index = 0;
        const clear = () => {//上传完成后,将状态回归
            upload_button_select.classList.remove('loading');
            upload_progress.style.display = 'none';
            upload_progress_value.style.width = '0%';
        };

        //每一次上传一个切片成功的处理[进度管控&切片合并]
        const complate = async () => {
            // 管控进度条:每上传完一个切片,就将进度条长度增加一点
            index++;
            upload_progress_value.style.width = `${index/count*100}%`;

            if (index < count) return;
            // 当所有切片都上传成功，就合并切片
            upload_progress_value.style.width = `100%`;
            try {
                //调用合并切片方法
                data = await instance.post('/upload_merge', {
                    HASH,
                    count
                }, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                if (+data.code === 0) {
                    alert(`恭喜您，文件上传成功，您可以基于 ${data.servicePath} 访问该文件~~`);
                    clear();
                    return;
                }
                throw data.codeText;
            } catch (err) {
                alert('切片合并失败，请您稍后再试~~');
                clear();
            }
        };

        // 循环上传每一个切片
        chunks.forEach(chunk => {
            // 已经上传的无需在上传
            //后台返回的already格式为['HASH_1.png','HASH_2.png'],既已经上传的文件的切片名
            if (already.length > 0 && already.includes(chunk.filename)) {
                //已经上传过了的切片就无需再调用接口上传了
                complate();//动进度条或合并所有切片
                return;
            }
            let fm = new FormData;
            fm.append('file', chunk.file);
            fm.append('filename', chunk.filename);
            instance.post('/upload_chunk', fm).then(data => {//使用form data格式上传切片
                if (+data.code === 0) {
                    complate();////动进度条或合并所有切片
                    return;
                }
                return Promise.reject(data.codeText);
            }).catch(() => {
                alert('当前切片上传失败，请您稍后再试~~');
                clear();
            });
        });
    });
    //触发原生的上传文件框
    upload_button_select.addEventListener('click', function () {
        if (checkIsDisable(this)) return;
        upload_inp.click();
    });
})();
