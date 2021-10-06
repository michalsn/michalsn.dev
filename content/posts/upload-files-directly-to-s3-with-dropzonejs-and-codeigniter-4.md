---
title: "Upload files directly to S3 with Dropzone.js"
date: 2021-05-09T16:49:45+02:00
tags: ["s3", "dropzone", "codeigniter4"]
draft: false
---

Uploading files directly to S3 requires a few changes to the way Dropzone handles uploads, but it's nothing particularly difficult.

<!--more-->

What we will need?
* [Dropzone.js](https://www.dropzone.dev/js/)
* [SparkMD5](https://github.com/satazor/js-spark-md5)
* [CodeIgniter 4](https://github.com/codeigniter4/CodeIgniter4)
* [AWS SDK for PHP](https://github.com/aws/aws-sdk-php)

Let's start by initializing Dropzone - the key method here is **transformFile**, which will make us get a presigned URL.

```
const baseUrl = '<?= base_url(); ?>';

myDropzone = new Dropzone('#myDropzone', {
    acceptedFiles: "image/jpeg,image/jpg",
    clickable: ".select-photos-btn",
    maxFilesize: 100,
    url: '#',
    method: 'post',
    timeout: 0,
    thumbnailMethod: 'crop',
    resizeQuality: 0.9,
    transformFile: async function (file, done) {
        file.md5 = await calculateMD5(file);
        let initData  = await initUpload(file.name, file.type, file.md5);
        file.presign  = initData.presign;
        file.fileName = initData.name;

        done(file);
    }
});
```

Let's also take a look at the **calculateMD5** function. We need it to be sure that the uploaded file was uploaded correctly - it's our checksum.

```
function calculateMD5(blob) {
    return new Promise(function (resolve, reject) {
        let reader = new FileReader();
        reader.readAsBinaryString(blob);
        reader.onloadend = function () {
            let hash = btoa(SparkMD5.hashBinary(reader.result, true));
            resolve(hash);
        };
    });
}
```

Once we have calculated the checksum, we can initiate the file upload:

```
function initUpload(name, contentType, md5) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            url: baseUrl + 'home/init_upload',
            data: {'file': name, 'content_type': contentType, 'md5': md5},
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            type: 'POST'
        })
        .done(function (respond) {
            if (respond.status) {
                resolve(respond.data);
            } else {
                reject()
            }
        })
        .fail(function () {
            reject()
        });
    });
}
```

It's time for the server part. For this, we need to install **CodeIgniter 4** and the **AWS** library:

```
composer create-project codeigniter4/appstarter codeigniter-dropzonejs --no-dev
```
```
composer require aws/aws-sdk-php
```

In the **Home** controller, we need to create a **init_upload** method. This method will be quite large. We could avoid it, for example, by creating a special Service to handle tasks related to S3, but because the example is to be as basic as possible, we will put everything in one place:

```
use App\Controllers\BaseController;
use Aws\S3\PostObjectV4;
use Aws\S3\S3Client;
use CodeIgniter\Exceptions\PageNotFoundException;

class Home extends BaseController
{
    ...

    public function init_upload()
    {
        if (! $this->request->isAjax()) {
            throw new PageNotFoundException();
        }

        if ($this->request->getMethod() !== 'post') {
            throw new PageNotFoundException();
        }

        if (! $file = $this->request->getPost('file')) {
            throw new PageNotFoundException();
        }

        if (! $contentType = $this->request->getPost('content_type')) {
            throw new PageNotFoundException();
        }

        if (! $md5 = $this->request->getPost('md5')) {
            throw new PageNotFoundException();
        }

        if (! in_array($contentType, ['image/jpeg', 'image/jpg'])) {
            throw new PageNotFoundException();
        }

        $file = service('security')->sanitizeFilename($file);

        $client = new S3Client([
            'version'     => 'latest',
            'region'      => 'type your S3 region here',
            'signature'   => 'v4',
            'credentials' => [
                'key'     => 'type your aws key here',
                'secret'  => 'type your aws secret here',
            ],
        ]);

        $bucket = 'type your bucket name here';

        $formInputs = [
            'acl'                   => 'private',
            'key'                   => $file,
            'success_action_status' => '201',
            'content-md5'           => $md5,
            'content-type'          => $contentType,
        ];

        $options = [
            ['acl'                   => 'private'],
            ['bucket'                => $bucket],
            ['success_action_status' => '201'],
            ['content-md5'           => $md5],
            ['content-type'          => $contentType],
            ['content-length-range', 0, 1024 * 1024 * 100],
            ['starts-with', '$key', $file],
        ];

        $postObject = new PostObjectV4(
            $client,
            $bucket,
            $formInputs,
            $options,
            '+15 minutes'
        );

        $formAttributes = $postObject->getFormAttributes();
        $formInputs     = $postObject->getFormInputs();
        
        return $this->response->setJSON([
            'status' => 1, 
            'data'   => [
                'name'    => $file, 
                'presign' => [
                    'attributes' => $attributes, 
                    'inputs'     => $inputs
                ]
            ]
        ]);

    }
}
```

Once we have the presigned URL generated, we need to force Dropzone to use it when uploading the file. We also need to include additional fields and attributes that will describe the exact file we are uploading. We do it this way:

```
myDropzone.on("sending", function (file, xhr, formData) {
    xhr.open(this.options.method, file.presign.attributes.action, true);

    Object.keys(file.presign.inputs).forEach(function (key) {
        formData.append(key, file.presign.inputs[key]);
    });

    let _send = xhr.send
    xhr.send = function () {
        _send.call(xhr, formData)
    }
});
```

All that remains now is to handle the success or failure of the upload. In the case of success, we need to change the final name of the file, which may have changed if the name contained forbidden characters:

```
myDropzone.on("success", function (file) {
    let elem = $(file.previewElement);
    elem.find('div[data-dz-name]').text(file.fileName);
});
```

If an error is returned, we should also display an appropriate message. For this purpose, we need to parse the XML response:

```
myDropzone.on("error", function (file, message) {
    if (file && message) {
        if (message.startsWith('<?xml version')) {
            const search = /<Message>(.*?)<\/Message>/g.exec(message);
            message = search[1];
            this.emit("error", file, message);
        }
    }
});
```

This way we can prepare a special upload link and upload the file to S3 using Dropzone.js. Then, S3 will verify the integrity of the file and check that it has the correct parameters that were specified when the special signed URL was generated.