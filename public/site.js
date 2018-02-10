$(function() {
	var isTestMode = false;
	var considerTime = 4000;		// time window to consider best capture, in ms
	var chillTime = 2000;			// time to chill after committing, in ms
	var historyMax = 3;				// max number of past captures to show on page

	var stopConsideringTimeout;
	var stopChillingTimeout;
	var status;						// disabled, watching, considering, chilling
	var bestCapture;				// most significant capture while considering

	var $toggle = $('.toggle');
	var $tweaks = $('.tweaks');
	var $video = $('.video');
	var $motionCanvas = $('.motion');
	var $motionScore = $('.motion-score');
	var $status = $('.status');
	var $meter = $('.meter');
	var $history = $('.history');

	var $pixelDiffThreshold = $('#pixel-diff-threshold');
	var $scoreThreshold = $('#score-threshold');
	var $historyItemTemplate = $('#history-item-template');

	function init() {
		// make sure we're on https when in prod
		var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
		if (!isLocal && window.location.protocol === 'http:') {
			var secureHref = window.location.href.replace(/^http/, 'https');
			window.location.href = secureHref;
		}

		// don't want console logs from adapter.js
		adapter.disableLog(true);

		setStatus('disabled');
		DiffCamEngine.init({
			video: $video[0],
			motionCanvas: $motionCanvas[0],
			pixelDiffThreshold :32,
			scoreThreshold : 400,
			initSuccessCallback: initSuccess,
			startCompleteCallback: startStreaming,
			captureCallback: checkCapture
		});
	}

	function initSuccess() {
		setTweakInputs();
		$toggle
			.addClass('start')
			.prop('disabled', false)
			.on('click', toggleStreaming);
		$tweaks
			.on('submit', getTweakInputs)
			.find('input').prop('disabled', false);
	}

	function setStatus(newStatus) {
		$meter.removeClass(status);

		status = newStatus;
		switch (status) {
			case 'disabled':
			case 'watching':
				$meter.css('animation-duration', '');
				break;
			case 'considering':
				$meter.css('animation-duration', considerTime + 'ms');
				break;
			case 'chilling':
				$meter.css('animation-duration', chillTime + 'ms');
				break;
		}

		$status.text(status);
		$meter.addClass(status);
	}

	function setTweakInputs() {
		$pixelDiffThreshold.val(DiffCamEngine.getPixelDiffThreshold());
		$scoreThreshold.val(DiffCamEngine.getScoreThreshold());
	}

	function getTweakInputs(e) {
		e.preventDefault();
		DiffCamEngine.setPixelDiffThreshold(+$pixelDiffThreshold.val());
		DiffCamEngine.setScoreThreshold(+$scoreThreshold.val());
	}

	function toggleStreaming() {
		if (status === 'disabled') {
			// this will turn around and call startStreaming() on success
			DiffCamEngine.start();
		} else {
			stopStreaming();
		}
	}

	function startStreaming() {
		startChilling();
		$toggle
			.removeClass('start')
			.addClass('stop');
	}

	function stopStreaming() {
		DiffCamEngine.stop();
		clearTimeout(stopConsideringTimeout);
		clearTimeout(stopChillingTimeout);
		setStatus('disabled');
		bestCapture = undefined;

		$motionScore.text('');
		$toggle
			.removeClass('stop')
			.addClass('start');
	}

	function checkCapture(capture) {
		$motionScore.text(capture.score);

		if (status === 'watching' && capture.hasMotion) {
			// this diff is good enough to start a consideration time window
			setStatus('considering');
			bestCapture = capture;
			stopConsideringTimeout = setTimeout(stopConsidering, considerTime);
		} else if (status === 'considering' && capture.score > bestCapture.score) {
			// this is the new best diff for this consideration time window
			bestCapture = capture;
		}
	}

	function stopConsidering() {
		commit();
		startChilling();
	}

	function startChilling() {
		setStatus('chilling');
		stopChillingTimeout = setTimeout(stopChilling, chillTime);
	}

	function stopChilling() {
		setStatus('watching');
	}

	function commit() {
		// prep values
		var bestCaptureUrl = bestCapture.getURL();
		var src = bestCaptureUrl;
		var time = new Date().toLocaleTimeString().toLowerCase();
		var score = bestCapture.score;

		// load html from template
		var html = $historyItemTemplate.html();
		var $newHistoryItem = $(html);
		
		// set values and add to page
		$newHistoryItem.find('img').attr('src', src);
		$newHistoryItem.find('.time').text(time);
		$newHistoryItem.find('.score').text(score);
		$history.prepend($newHistoryItem);

		// trim
		$trim = $('.history figure').slice(historyMax);
		$trim.find('img').attr('src', '');
		$trim.remove();
		
		// Azure Vision Services
		processImage(src);
		
		bestCapture = undefined;
	}

	// kick things off
	init();
});

function processImage(imageData) {	
		$("#log").append("inside process image");
	
        // **********************************************
        // *** Update or verify the following values. ***
        // **********************************************

        // Replace the subscriptionKey string value with your valid subscription key.
        var subscriptionKey = "25cf06087d674ebf99a3e25a5ead3384";

        // Replace or verify the region.
        //
        // You must use the same region in your REST API call as you used to obtain your subscription keys.
        // For example, if you obtained your subscription keys from the westus region, replace
        // "westcentralus" in the URI below with "westus".
        //
        // NOTE: Free trial subscription keys are generated in the westcentralus region, so if you are using
        // a free trial subscription key, you should not need to change this region.
        

        var uriBase = "https://southeastasia.api.cognitive.microsoft.com/vision/v1.0/analyze";

         // Request parameters.
        var params = {
            "visualFeatures": "Categories,Description,Color",
            "details": "",
            "language": "en",
        };
        
		makeblob = function (dataURL) {
            var BASE64_MARKER = ';base64,';
            if (dataURL.indexOf(BASE64_MARKER) == -1) {
                var parts = dataURL.split(',');
                var contentType = parts[0].split(':')[1];
                var raw = decodeURIComponent(parts[1]);
                return new Blob([raw], { type: contentType });
            }
            var parts = dataURL.split(BASE64_MARKER);
            var contentType = parts[0].split(':')[1];
            var raw = window.atob(parts[1]);
            var rawLength = raw.length;

            var uInt8Array = new Uint8Array(rawLength);

            for (var i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }

            return new Blob([uInt8Array], { type: contentType });
        }
		
		uploadFile(makeblob(imageData));
        
        // Perform the REST API call.
		/*
        $.ajax({
            url: uriBase + "?" + $.param(params),
  			processData: false,
			contentType: 'application/octet-stream',
            // Request headers.
            beforeSend: function(xhrObj){
                xhrObj.setRequestHeader("Content-Type","application/octet-stream");
                xhrObj.setRequestHeader("Ocp-Apim-Subscription-Key", subscriptionKey);
            },

            type: "POST",

            // Request body.
            //data: '{"url": ' + '"' + dataImage + '"}',
            data: makeblob(imageData)
        })
        .done(function(data) {
	        //alert(2);
            // Show formatted JSON on webpage.

            var description = data.description.captions[0].text;
            
            $("#responseTextArea").val(JSON.stringify(data, null, 2));
            $("#description").html(description);
            
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
	        //alert(3);
            // Display error message.
            var errorString = (errorThrown === "") ? "Error. " : errorThrown + " (" + jqXHR.status + "): ";
            errorString += (jqXHR.responseText === "") ? "" : (jQuery.parseJSON(jqXHR.responseText).message) ? 
                jQuery.parseJSON(jqXHR.responseText).message : jQuery.parseJSON(jqXHR.responseText).error.message;
            //alert(errorString);
            //$("#responseTextArea").val(errorString);
        });
		*/
};