attribute  vec4 vPosition;
attribute  vec4 vColor;
varying vec4 fColor;

uniform mat4 transform;

void main()
{
	gl_PointSize = 5.0;
	fColor = vColor;
	gl_Position = transform * vPosition;
}
