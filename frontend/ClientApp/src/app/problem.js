"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Problem = exports.Route = void 0;
var Route = /** @class */ (function () {
    function Route() {
        this.FEET = [];
        this.START = [];
        this.MOVES = [];
        this.TOP = [];
    }
    return Route;
}());
exports.Route = Route;
var Problem = /** @class */ (function () {
    function Problem() {
        this.route = new Route();
    }
    return Problem;
}());
exports.Problem = Problem;
//# sourceMappingURL=problem.js.map