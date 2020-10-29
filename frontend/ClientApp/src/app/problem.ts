export class Route {
  FEET: string[];
  START: string[];
  MOVES: string[];
  TOP: string[];

  constructor() {
    this.FEET = [];
    this.START = [];
    this.MOVES = [];
    this.TOP = [];
  }
}

export class Problem {
  id: string;
  name: string;
  difficulty: string;
  setter: string;
  route: Route;

  constructor() {
    this.route = new Route();
  }
}
