attribute  vec4 vPosition;

uniform mat4 transform;

void main()
{
	gl_Position = transform * vPosition;
}
