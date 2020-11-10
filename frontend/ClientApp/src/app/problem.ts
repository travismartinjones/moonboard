export class RgbIndex {
  index: string;
  r: number;
  g: number;
  b: number;
}

export class Route {
  FEET: string[];
  START: string[];
  MOVES: string[];
  TOP: string[];
  RGB: RgbIndex[];

  constructor() {
    this.FEET = [];
    this.START = [];
    this.MOVES = [];
    this.TOP = [];
    this.RGB = [];
  }
}

export class Problem {

  static readonly currentSetup: string = "Nov2020";
  id: string;
  name: string;
  difficulty: string;
  setter: string;
  notes: string;
  route: Route;
  setup: string;
  isNew: boolean;

  constructor() {
    this.route = new Route();
    this.isNew = true;
    this.setup = Problem.currentSetup;
  }
}
