/**
 * @ngdoc service
 * @name $body
 * @requires $document
 *
 * @description
 * A {@link angular.element jQuery or jqLite} wrapper for the browser's `document.body` object.
 */
function $BodyProvider() {
  this.$get = ['$document', function($document) {
    return jqLite($document[0].body);
  }];
}
