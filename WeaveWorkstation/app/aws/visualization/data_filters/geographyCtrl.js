analysis_mod.controller('GeographyCtrl', function($scope, queryService){
	
	queryService.queryObject.GeographyFilter = {
			state : {},
			counties : {},
			stateColumn : {},
			stateColumn : {}
	};
	
	var geoTreeData;
	
	var stateValueKey = null;
	var stateLabelKey = null;
	var countyValueKey = null;
	var countyLabelKey = null;
	var processedMetadata;
	var geographyMetadata = null;
	var metadataTableTitle = null;
	
	$scope.$watch(function() {
		return queryService.dataObject.dataTableList;
	}, function() {
		$scope.dataTableOptions = queryService.dataObject.dataTableList;
	});
	
	$scope.$watch('stateDBSelection', function() {
		if($scope.stateDBSelection != undefined) {
			if($scope.stateDBSelection != "") {
				queryService.queryObject.GeographyFilter.stateColumn = angular.fromJson($scope.stateDBSelection);
			} else {
				queryService.queryObject.GeographyFilter.stateColumn = {};
			}
		}
	});
	
	$scope.$watch('countyDBSelection', function() {
		if($scope.stateDBSelection != undefined) {
			if($scope.stateDBSelection != "") {
				queryService.queryObject.GeographyFilter.countyColumn = angular.fromJson($scope.countyDBSelection);
			} else {
				queryService.queryObject.GeographyFilter.countyColumn = {};
			}
		}
	});
	
	$scope.$watch('metadataTableSelection', function() {
		if($scope.metadataTableSelection != undefined) {
			if($scope.metadataTableSelection != "") {
				
				queryService.queryObject.GeographyFilter.metadataTableId = angular.fromJson($scope.metadataTableSelection).id;
				
				aws.DataClient.getDataColumnEntities([angular.fromJson($scope.metadataTableSelection).id], function(metadataTableArray) {
					
					var metadataTable = metadataTableArray[0];
					
					if(metadataTable.publicMetadata.hasOwnProperty("stateValues")) {
						stateValueKey = metadataTable.publicMetadata.stateValues;
					}
					if( metadataTable.publicMetadata.hasOwnProperty("stateLabels")) {
						stateLabelKey = metadataTable.publicMetadata.stateLabels;
					}
					
					if( metadataTable.publicMetadata.hasOwnProperty("countyValues")) {
						countyValueKey = metadataTable.publicMetadata.countyValues;
					}
					
					if( metadataTable.publicMetadata.hasOwnProperty("countyLabels")) {
						countyLabelKey = metadataTable.publicMetadata.countyLabels;
					}
					if( metadataTable.publicMetadata.hasOwnProperty("title")) {
						metadataTableTitle = metadataTable.publicMetadata.title;
					}
					
					$scope.$apply();
					
					queryService.getDataSetFromTableId(metadataTable.id);
					
					
				});
			}
		}
	});
	
	$scope.$watchCollection(function() {
		return [queryService.dataObject.geographyMetadata,
		         							stateValueKey,
		         							stateLabelKey,
		         							countyValueKey,
		         							countyLabelKey,
		         							metadataTableTitle];
	}, function() {
		
		geographyMetadata = queryService.dataObject.geographyMetadata;
		if(geographyMetadata) {
			if(stateValueKey == null ||
			   stateLabelKey == null ||
			   countyValueKey == null ||
			   countyLabelKey == null ||
			   metadataTableTitle == null) {
			   console.log("Could not find all the geography metadata");
			} else {
				var records = geographyMetadata.records[metadataTableTitle];
				processedMetadata = [];
				for(key in records) {
					var record = records[key];
					// push the first state
					if(!processedMetadata.length) {
						processedMetadata.push({value : record[stateValueKey], 
							label : record[stateLabelKey],
							counties : []});
					}
					
					for(var i = 0; i < processedMetadata.length; i++) {
						if(record[stateValueKey] == processedMetadata[i].value) {
							processedMetadata[i].counties.push({value : record[countyValueKey],
								label : record[countyLabelKey]});
						break;
						}
						
						else if( record[stateValueKey] != processedMetadata[i].value ) {
							
							if (i == processedMetadata.length - 1){
						
								// we r	eached the end of the processedMetadata array without finding the corresponding state,
								// which means it's a new state
								processedMetadata.push({value : record[stateValueKey], 
									label : record[stateLabelKey],
									counties : [/*{value : record[countyValueKey],
									label : record[countyLabelKey]
								
								}*/]});
							} else {
								//continue the search
								continue;
							}
						}
					} 
				}
			}
		}
		
	});

	$scope.$watchCollection(function() {

		return [$scope.stateDBSelection, $scope.countyDBSelection, processedMetadata];
		
	}, function() {
		
		if($scope.stateDBSelection != undefined && $scope.countyDBSelection != undefined && processedMetadata != undefined) {
			if($scope.stateDBSelection != "" && $scope.countyDBSelection != "" && processedMetadata.length) {
				geoTreeData = createGeoTreeData(processedMetadata);
			}
		}
	});
	
	var createGeoTreeData = function(metadata) {
		var treeData = [];
		for(var i in metadata) {
			treeData[i] = { title : metadata[i].label, key : metadata[i].value, isFolder : true,  children : [] };
			for(var j in metadata[i].counties) {
				treeData[i].children.push({ title : metadata[i].counties[j].label, key : metadata[i].counties[j].value });
			}
		}
		return treeData;
	}
	
	$scope.$watch(function() {
		return queryService.dataObject.columns;
	}, function() {
		if(queryService.dataObject.columns != undefined) {
			
			$scope.stateDBOptions = $.map(queryService.dataObject.columns, function(column) {
					var aws_metadata = angular.fromJson(column.publicMetadata.aws_metadata);
					if(aws_metadata != undefined){
						if(aws_metadata.hasOwnProperty("columnType")) {
							if(aws_metadata.columnType == "geography") {
								return { id : column.id , title : column.publicMetadata.title};
							} else {
								// skip
							}
						}
					}
				});
			$scope.countyDBOptions = $scope.stateDBOptions;
		};
	});
	
	$scope.$watch(function() {
		return geoTreeData;
	}, function(){
		$("#geoTree").dynatree({
			minExpandLevel: 1,
			checkbox : true,
			selectMode : 3,
			children : geoTreeData,
			keyBoard : true,
			onSelect: function(select, node) {
				var states_nodes = {};
				var counties_nodes = {};
				$("#geoTree").dynatree("getRoot").visit(function(node){
					var partSel = [];
					if(node.childList) { // dirty check to see if year node
						if(node.bSelected) {
							states_nodes[node.data.key] = node.data.title;
						}
					} else {
						if(node.bSelected) {
							counties_nodes[node.data.key] = node.data.title;
						}
					}
					$(".dynatree-partsel:not(.dynatree-selected)").each(function () {
				        var node = $.ui.dynatree.getNode(this);
				        if(node.childList) {
				        	states_nodes[node.data.key] = node.data.title;
				        } else {
				        	
				        }
				    });
				});

					var states_array = [];
					var counties_array = [];
					for(key in states_nodes) {
						states_array.push({value : key, label : states_nodes[key]});
					}
					for(key in counties_nodes) {
						counties_array.push({value : key, label : counties_nodes[key]});
					}
					
					queryService.queryObject.GeographyFilter.states = states_array;
					queryService.queryObject.GeographyFilter.states = counties_array;
			},
			 onKeydown: function(node, event) {
				 if( event.which == 32 ) {
					 node.toggleSelect();
					 return false;
				 }
		     },
		     cookieId: "geo-tree",
		     idPrefix: "geo-tree-",
		     debugLevel: 0
		});
		
		var node = $("#geoTree").dynatree("getRoot");
	    node.sortChildren(cmp, true);
		$("#geoTree").dynatree("getTree").reload();
	});
	
	 $scope.toggleSelect = function(){
	      $("#geoTree").dynatree("getRoot").visit(function(node){
	        node.toggleSelect();
	      });
	 };
	 
	$scope.deSelectAll = function(){
      $("#geoTree").dynatree("getRoot").visit(function(node){
        node.select(false);
      });
    };
    
    $scope.selectAll = function(){
    	$("#geoTree").dynatree("getRoot").visit(function(node){
    		node.select(true);
    	});
    };
    
     var cmp = function(a, b) {
        a = a.data.title.toLowerCase();
        b = b.data.title.toLowerCase();
        return a > b ? 1 : a < b ? -1 : 0;
     };
});