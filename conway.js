'use strict';
import { get_shader, init_shaders } from './shaders.js';

const [vertex_shader, fragment_shader] = [
	'shaders/vertex-shader.glsl',
	'shaders/fragment-shader.glsl'
].map(get_shader);


let gl = null;
let program = null;
const numVertices  = 36;
const points = [];
const colors = [];

let zoom = 1.0;
let movement = false;     // Do we rotate?
let spinX = 0;
let spinY = 0;
let origX = null;
let origY = null;

let matrixLoc = null;
let colourLoc = null;

export async function init() {
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

	//vertex color assigned by the index of the vertex
	const indices = [ a, b, c, a, c, d ];

	for (let i = 0; i < indices.length; ++i ) {
		points.push( vertices[indices[i]] );
	}
}

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	let mv = mat4();
	mv = mult(mv, scalem(zoom, zoom, zoom));
	mv = mult(mv, rotateX(spinX));
	mv = mult(mv, rotateY(spinY));

	gl.uniform4fv(colourLoc, vec4(0.0, 0.0, 1.0, 1.0));
	gl.uniformMatrix4fv(
		matrixLoc,
		false,
		flatten(mv)
	);
	gl.drawArrays(gl.TRIANGLES, 0, numVertices);

	requestAnimFrame(render);
}
