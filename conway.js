'use strict';
import { get_shader, init_shaders } from './shaders.js';

const [vertex_shader, fragment_shader] = [
	'shaders/vertex-shader.glsl',
	'shaders/fragment-shader.glsl'
].map(get_shader);


let gl = null;
let program = null;
let board = null;
const numVertices  = 36;
const points = [];
const colors = [];

let zoom = 0.7;
let movement = false;     // Do we rotate?
let spinX = 0;
let spinY = 0;
let origX = null;
let origY = null;

let matrixLoc = null;
let colourLoc = null;

export async function init() {
	board = new Board(10, 10, 10);
	const canvas = document.querySelector('canvas');
	gl = WebGLUtils.setupWebGL(canvas);

	if (!gl)
		alert("WebGL is not available");

	cube();

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(1.0, 1.0, 1.0, 1.0);

	gl.enable(gl.DEPTH_TEST);

	program = await init_shaders(gl, await vertex_shader, await fragment_shader);
	gl.useProgram(program);

	const cBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );

	var vColor = gl.getAttribLocation( program, "vColor" );
	gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
	gl.enableVertexAttribArray( vColor );


	const vBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

	const vPosition = gl.getAttribLocation(program, "vPosition");
	gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray( vPosition );

	matrixLoc = gl.getUniformLocation(program, "transform");
	colourLoc = gl.getUniformLocation(program, "colour");

	//event listeners for mouse
	canvas.addEventListener("mousedown", function(e){
		movement = true;
		origX = e.offsetX;
		origY = e.offsetY;
		e.preventDefault(); // Disable drag and drop
	});

	canvas.addEventListener("mouseup", function(e){
		movement = false;
	});

	canvas.addEventListener("mousemove", function(e){
		if(movement) {
			spinY = (spinY + (origX - e.offsetX)) % 360;
			spinX = (spinX + (origY - e.offsetY)) % 360;
			origX = e.offsetX;
			origY = e.offsetY;
		}
	});

	canvas.addEventListener('wheel', (event) => {
		zoom = Math.max(0.001, zoom + ((event.deltaY < 0) ? -1 : 1) * 0.01);
	}, { passive: false });

	render();
	setInterval(() => { board.next_generation()}, 200);
}

function cube() {
	quad(1, 0, 3, 2);
	quad(2, 3, 7, 6);
	quad(3, 0, 4, 7);
	quad(6, 5, 1, 2);
	quad(4, 5, 6, 7);
	quad(5, 4, 0, 1);
}

function quad(a, b, c, d) {
	const vertices = [
		vec3(-0.5, -0.5, 0.5),
		vec3(-0.5, 0.5, 0.5),
		vec3( 0.5, 0.5, 0.5),
		vec3( 0.5, -0.5, 0.5),
		vec3(-0.5, -0.5, -0.5),
		vec3(-0.5, 0.5, -0.5),
		vec3( 0.5, 0.5, -0.5),
		vec3( 0.5, -0.5, -0.5)
	];

	const vertexColors = [
		[ 0.0, 0.0, 0.0, 1.0 ], // black
		[ 1.0, 0.0, 0.0, 1.0 ], // red
		[ 1.0, 1.0, 0.0, 1.0 ], // yellow
		[ 0.0, 1.0, 0.0, 1.0 ], // green
		[ 0.0, 0.0, 1.0, 1.0 ], // blue
		[ 1.0, 0.0, 1.0, 1.0 ], // magenta
		[ 0.0, 1.0, 1.0, 1.0 ], // cyan
		[ 1.0, 1.0, 1.0, 1.0 ] // white
	];
	//vertex color assigned by the index of the vertex
	const indices = [ a, b, c, a, c, d ];

	for (let i = 0; i < indices.length; ++i ) {
		points.push(vertices[indices[i]]);
		colors.push(vertexColors[a]);
	}
}

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	const grid = {
		width: 2 / board.width,
		height: 2 / board.height,
		depth: 2 / board.depth,
	};

	const cube = {
		width: 0.8 * grid.width,
		height: 0.8 * grid.height,
		depth: 0.8 * grid.depth,
	}

	for (let i = 0; i < board.width; ++i)
		for (let j = 0; j < board.height; ++j)
			for (let k = 0; k < board.depth; ++k) {
				const health = board.get(i, j, k);
				if (health > 0) {
					let mv = mat4();
					mv = mult(mv, scalem(zoom, zoom, zoom));
					mv = mult(mv, translate(-1, -1, -1));
					mv = mult(mv, rotateX(spinX));
					mv = mult(mv, rotateY(spinY));
					mv = mult(mv, translate(
						i * grid.width,
						j * grid.height,
						k * grid.depth
					));

					mv = mult(mv, scalem(
						cube.width * health,
						cube.height * health,
						cube.depth * health
					));
					gl.uniformMatrix4fv(
						matrixLoc,
						false,
						flatten(mv)
					);
					gl.drawArrays(gl.TRIANGLES, 0, numVertices);
				}
			}

	requestAnimFrame(render);
}

class Board {
	constructor(width, height, depth) {
		this.width = width;
		this.height = height;
		this.depth = depth;
		this.slots = new Array(width * height * depth);
		this.dying = new Array(width * height * depth);

		for (let i = 0; i < this.slots.length; ++i) {
			this.slots[i] = (Math.random() < 0.3) ? 1 : 0;
		}
		this.dying.fill(false);
	}

	next_generation() {
		const slots = new Array(this.slots.length);
		for (let i = 0; i < this.width; ++i)
			for (let j = 0; j < this.height; ++j)
				for (let k = 0; k < this.depth; ++k)
					slots[this.flatten(i, j, k)] = this.next_state(i, j, k);

		this.slots = slots;
	}

	flatten(x, y, z) {
		return x + this.width * (y + this.depth * z);
	}

	get(x, y, z) {
		return this.slots[this.flatten(x, y, z)];
	}

	set(x, y, z, value) {
		this.slots[this.flatten(x, y, z)] = value;
	}

	is_dying(x, y, z) {
		return this.dying[this.flatten(x, y, z)];
	}

	neighbours(x, y, z) {
		const n = [];
		for (let i = -1; i < 2; ++i) {
			for (let j = -1; j < 2; ++j) {
				for (let k = -1; k < 2; ++k) {
					if (i === 0 && j === 0 && k === 0)
						continue;
					n.push([
						knuth_mod(x + i, this.width),
						knuth_mod(y + j, this.height),
						knuth_mod(z + k, this.depth),
					]);
				}
			}
		}
		return n;
	}

	num_living_neighbours(x, y, z) {
		return this.neighbours(x, y, z)
			.map(p => this.get(...p))
			.reduce((a, b) => b ? a + 1 : a, 0);
	}

	stays_alive(x, y, z) {
		const n = this.num_living_neighbours(x, y, z);
		return 5 <= n && n <= 7;
	}

	comes_alive(x, y, z) {
		return this.num_living_neighbours(x, y, z) === 6;
	}

	next_state(x, y, z) {
		const current = this.get(x, y, z);
		if (current <= 0) {
			if (this.comes_alive(x, y, z)) {
				this.dying[this.flatten(x, y, z)] = false;
				return 0.1;
			}
			return 0;
		}
		if (current >= 1) {
			if (!this.stays_alive(x, y, z)) {
				this.dying[this.flatten(x, y, z)] = true;
				return 0.9;
			}
			return 1;
		}
		return current + (this.is_dying(x, y, z) ? -1 : 1) * 0.1;
	}
}

function knuth_mod(a, n) {
	return a - n * Math.floor(a / n);
}

function clamp(min, x, max) {
	return Math.max(Math.min(x, max), min);
}
