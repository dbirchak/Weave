AnalysisModule.directive('columnSelector', function(queryService) {
	
	function link($scope, element, attrs) {
		
		$scope.showHierarchy = function() {
			queryService.queryObject.properties.showHierarchy = true;
		};

		$scope.clear = function() {
			if($scope.model)
				$scope.model.selected = "";
		};
		
		$scope.$watch('model.selected', function(model) { 
			$scope.ngModel = model;
		}, true);
		
		element.find("#panel").draggable().resizable();
	}
	
	function controller($scope, $element) {
			
		
	}
	
	return {
		restrict : 'E',
		transclude : true,
		templateUrl : 'src/directive/column-selector/column_selector.tpl.html',
		link : link,
		controller : controller,
		scope : {
			ngModel : '=',
			hierarchy : '='
		}
	};
});