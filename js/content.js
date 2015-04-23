	
	L.mapbox.accessToken = 'pk.eyJ1IjoiYXJhbmtoYW5uYSIsImEiOiJEdDJreGxjIn0.Y3-LSV20SRRZOzs_6nSFjA';
	var map = null;

	// List of FB users and their most recent points
	var user_dict = {};
	// User to focus in on
	var focus_user = null;
	// Lines between points drawn
	var polyline = null;

	$( document ).ready(function() {
		// Create map for DOM
		var mapDiv = document.createElement('div');
		mapDiv.id = 'map';
    	// $('#pagelet_web_messenger').append(mapDiv);
    	$('#contentCol').append(mapDiv);

    	// Create icon container
    	var containerDiv = document.createElement('div');
		containerDiv.id = 'button-container';
		$('#map').append(containerDiv);

    	// Create icon to change layers
		var backButton = document.createElement('a');
        backButton.href = '#';
        backButton.id = 'back-button';
        backButton.innerHTML = "Info";
        $('#button-container').append(backButton);

		$('#back-button').on("click", function(){
			if(focus_user != null){

				// Remove zoomed layers
				map.removeLayer(polyline);
			 	polyline = null;
				for(var i=0; i<user_dict[focus_user]["layers"].length; i++){
					map.removeLayer(user_dict[focus_user]["layers"][i]["layer"]);	
				}
				focus_user = null;
				$(this).text('Info');

				// Set to default layer (no-zoom)
				for(var key in user_dict){
					user_dict[key]["last_layer"].addTo(map);
				}
				updateOpacities();

			}else{
				alert("These are the last recorded positions of your friends reported by FB chat. Click any icon to view that user's location history. Fainter pictures denote data recorded further in the past.");
			}
		});

		// Set scene to default home
		map = L.mapbox.map('map', 'arankhanna.lnl5mal6')
		 .setView([42.381982, -71.124694], 3);

		// Set to default layer (no-zoom)
		for(var key in user_dict){
			user_dict[key]["last_layer"].addTo(map);
		}
		updateOpacities();
	});
	
	function updateOpacities(){
		var min = Number.MAX_VALUE;
		var max = 0;
		if(focus_user == null){
			// Calculate min and max (for 1 element min=max)
			for(var key in user_dict){
				if(user_dict[key]["last_time"] > max){
					max = user_dict[key]["last_time"]
				}
				if(user_dict[key]["last_time"] < min){
					min = user_dict[key]["last_time"]
				}
			}

			for(var key in user_dict){
				if(max != min){
					// Opacity is set to % of total range with 0.3 as floor
					var calcOpacity = (((user_dict[key]["last_time"] - min)/(max - min))*0.7) + 0.3;
					$('.'+key+'-'+user_dict[key]["last_time"]).css({opacity: calcOpacity});
				}
			}
		}else{
			for(var i=0; i<user_dict[focus_user]["layers"].length; i++){
				if(user_dict[focus_user]["layers"][i]["time"] > max){
					max = user_dict[focus_user]["layers"][i]["time"];
				}
				if(user_dict[focus_user]["layers"][i]["time"] < min){
					min = user_dict[focus_user]["layers"][i]["time"];
				}
			}

			for(var i=0; i<user_dict[focus_user]["layers"].length; i++){
				// Opacity is set to % of total range with 0.3 as floor
				var calcOpacity = (((user_dict[focus_user]["layers"][i]["time"] - min)/(max - min))*0.7) + 0.3;
				$('.'+focus_user+'-'+user_dict[focus_user]["layers"][i]["time"]).css({opacity: calcOpacity});
			}
		}
	}


	// Getting FB images doesn't work with ghostery or other tracker blockers
	function addLayer(data){
		$.ajax({
			type:"GET",
			url: "https://graph.facebook.com/"+data.user,
			complete: function(msg){
				var userInfo = jQuery.parseJSON(msg.responseText);

				// Create data point layer
				var date =  new Date(data.time);
				var layer = L.mapbox.featureLayer();
				// TODO use FB api to pull name
				var geoJSON = {
				    type: 'Feature',
				    geometry: {
				        type: 'Point',
				        // coordinates here are in longitude, latitude order
				        coordinates: [
				          data.longitude,
				          data.latitude 
				        ]
				    },
				    properties: {
				        title: userInfo["first_name"] +" "+ userInfo["last_name"],
				        description: 'Recorded at: '+date.toGMTString(),
				        icon: {
				        	className: "dot "+data.user+"-"+data.time,
				        	iconUrl: "https://graph.facebook.com/"+data.user+"/picture?type=square",
				        	iconSize: [20, 20],
				        	iconAnchor: [10,10],
				        	popupAnchor:[0,-10]
				        }
				    }
				}

				layer.on('layeradd', function(e) {
				    var marker = e.layer,
				        feature = marker.feature;
				    marker.setIcon(L.icon(feature.properties.icon));
				});

				layer.on('click', function(e){
					if(focus_user == null){
						focus_user =  data.user;
						$('#back-button').text('Back');

						for(var key in user_dict){
							map.removeLayer(user_dict[key]["last_layer"]);
						}

						var line = [];
						var polyline_options = {
							color: '#3B5998'
						};
						var sorted = user_dict[data.user]["layers"].sort(function(a,b){return a['time'] - b['time']});
						for(var i=0; i<sorted.length; i++){
							user_dict[data.user]["layers"][i]["layer"].addTo(map);
							line.push(user_dict[data.user]["layers"][i]["latlng"]);
						}
						polyline = L.polyline(line, polyline_options).addTo(map);

						updateOpacities();
					}
				});

				layer.setGeoJSON(geoJSON);

				// If user hasn't been recorded set this as their most recent point
				if(user_dict[data.user] == undefined){
					user_dict[data.user] = {
						last_time: data.time,
						last_layer: layer,
						layers: [{
							layer: layer,
							time: data.time,
							latlng: {
								lat: data.latitude,
								lng: data.longitude
							}
						}]
					}
					// Add to map if not zoomed on user
					if(map != null && focus_user==null){
						layer.addTo(map);
						updateOpacities();
					}
				}else{
					// Add recorded point to user object
					user_dict[data.user]["layers"].push({
						layer: layer,
						time: data.time,
						latlng: {
							lat: data.latitude,
							lng: data.longitude
						}
					});
					// If this is newst point remove curret one and update
					if(data.time > user_dict[data.user]["last_time"]){
						// This layer may already be removed if it is zoomed or null
						if(map != null && focus_user==null){
							map.removeLayer(user_dict[data.user]["last_layer"]);
						}
						user_dict[data.user]["last_time"] = data.time;
						user_dict[data.user]["last_layer"] = layer;
						// Add to map if not zoomed on user
						if(map != null && focus_user==null){
							layer.addTo(map);
							updateOpacities();
						}
					}
				}
			}
		});
	}


	chrome.runtime.onMessage.addListener(
	  function(request, sender, sendResponse) {
    	console.log("requesting");
    	$.ajax({
	        type:"POST",
	        url: "https://www.facebook.com/ajax/mercury/thread_info.php",
	        data: request.bodyText,
	        processData: false,
	        complete: function(msg) {
	        	var json = jQuery.parseJSON(msg.responseText.split(';')[3]);
	        	var messages = json.payload.actions;
	        	console.log(messages);
	        	for(var i =0; i<messages.length; i++){
	        		if(messages[i]['coordinates'] != null){
		        		var data = {
		        			"latitude": messages[i]['coordinates']['latitude'],
		        			"longitude": messages[i]['coordinates']['longitude'],
		        			"time": messages[i]['timestamp'],
		        			"user": messages[i]['author'].split(':')[1]
		        		}
	        			console.log(data);
	        			addLayer(data);
	        		}
	        	}
	        }
		});
	  }
	);