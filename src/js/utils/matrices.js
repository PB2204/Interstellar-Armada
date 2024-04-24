/**
 * @param utils Used for Pi related constants
 * @param vec Used for vector operations (such as calculating lengths or angles of vectors)
 */
define([
    "utils/utils",
    "utils/vectors"
], function (utils, vec) {
    "use strict";

    var mat = {},
            // ----------------------------------------------------------------------
            // constants
            /**
             * Used as error threshold - numbers larger than this can be exchanged for the number 1 in certain places
             * @type Number
             */
            CLOSE_TO_ONE_THRESHOLD = 0.99999,
            /**
             * The number of auxiliary matrices that should be created.
             * @type Number
             */
            AUX_MATRIX_COUNT = 20,
            // ----------------------------------------------------------------------
            // private variables
            /**
             * @typedef {object} TempMatrixObject
             * @property {Float32Array} matrix
             * @property {Boolean} used
             */
            /**
             * Stores matrices used for temporary values during matrix calculations so fewer new matrices need to be created.
             * These matrices are for internal use only, when a temporary matrix is required during one operation but can be disposed of
             * when the operation is complete.
             * @type TempMatrixObject[]
             */
            _tempMatrices = [],
            /**
             * Stores auxiliary matrices used for holding the results of temporary calculations. Operations returning a new matrix can have
             * an alternate version which uses one of the auxiliary matrices, thus avoiding creating a new matrix. This can
             * be utilized by the users of this library by using the auxiliary version where the result is not persistently needed.
             * There is a fixed amount of these matrices available and the operations cycle through them, so they can be used in (not too
             * deep) combined operations, but not for recursion.
             * @type Float32Array[]
             */
            _auxMatrices = [],
            /**
             * The index of the auxiliary matrix to be used for the next auxiliary matrix operation.
             * @type Number
             */
            _auxMatrixIndex = 0,
            /**
             * 3x3 auxiliary matrices.
             * @type Float32Array[]
             */
            _auxMatrices3 = [],
            /**
             * The index of the 3x3 auxiliary matrix to be used for the next 3x3 auxiliary matrix operation.
             * @type Number
             */
            _auxMatrix3Index = 0,
            /**
             * Stores how many new matrices have been created.
             * @type Number
             */
            _matrixCount = 0;
    // -----------------------------------------------------------------------------
    // Private functions with the matrix counter
    /**
     * Clears the counter storing how many new matrices have been created.
     */
    mat.clearMatrixCount = function () {
        _matrixCount = 0;
    };
    /**
     * Returns how many matrices have been created using the functions of this module.
     * @returns {Number}
     */
    mat.getMatrixCount = function () {
        return _matrixCount;
    };
    // -----------------------------------------------------------------------------
    // Private functions with temporary matrices
    /**
     * Returns an index at which a free (currently not used) temporary matrix is available.
     * @returns {Number}
     */
    function _getFreeTempMatrixIndex() {
        var i;
        for (i = 0; i < _tempMatrices.length; i++) {
            if (!_tempMatrices[i].used) {
                return i;
            }
        }
        _tempMatrices.push({
            used: false,
            matrix: mat.identity4()
        });
        return _tempMatrices.length - 1;
    }
    /**
     * Returns the temporary matrix stored at the passed index as well as marks it as used.
     * @param {Number} index
     * @returns {Float32Array}
     */
    function _getTempMatrix(index) {
        _tempMatrices[index].used = true;
        return _tempMatrices[index].matrix;
    }
    /**
     * Marks the temporary matrix at the passed index as free.
     * @param {Number} index
     */
    function _releaseTempMatrix(index) {
        _tempMatrices[index].used = false;
    }
    // -----------------------------------------------------------------------------
    // Functions that create new matrices and constant matrices
    /**
     * Returns a 3x3 identity matrix.
     * @returns {Float32Array}
     */
    mat.identity3 = function () {
        _matrixCount++;
        return new Float32Array([
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
        ]);
    };
    /**
     * Returns a 3x3 identity matrix.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @returns {Float32Array}
     */
    mat.identity3Aux = function () {
        var aux = _auxMatrices3[_auxMatrix3Index];
        aux[0] = 1.0;
        aux[1] = 0.0;
        aux[2] = 0.0;
        aux[3] = 0.0;
        aux[4] = 1.0;
        aux[5] = 0.0;
        aux[6] = 0.0;
        aux[7] = 0.0;
        aux[8] = 1.0;
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * A constant 3x3 identity matrix.
     * @type Float32Array
     */
    mat.IDENTITY3 = mat.identity3();
    /**
     * Returns a 4x4 identity matrix.
     * @returns {Float32Array}
     */
    mat.identity4 = function () {
        _matrixCount++;
        return new Float32Array([
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        ]);
    };
    /**
     * Returns a 4x4 identity matrix.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @returns {Float32Array}
     */
    mat.identity4Aux = function () {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = 1.0;
        aux[1] = 0.0;
        aux[2] = 0.0;
        aux[3] = 0.0;
        aux[4] = 0.0;
        aux[5] = 1.0;
        aux[6] = 0.0;
        aux[7] = 0.0;
        aux[8] = 0.0;
        aux[9] = 0.0;
        aux[10] = 1.0;
        aux[11] = 0.0;
        aux[12] = 0.0;
        aux[13] = 0.0;
        aux[14] = 0.0;
        aux[15] = 1.0;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * A constant 4x4 identity matrix.
     * @type Float32Array
     */
    mat.IDENTITY4 = mat.identity4();
    /**
     * Copies the passed matrix into a new one and returns it.
     * @param {Float32Array} m
     * @returns {Float32Array}
     */
    mat.copy = function (m) {
        _matrixCount++;
        return new Float32Array(m);
    };
    /**
     * Return a 3x3 matrix comprised of the first 9 elements of the passed array.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array|Number[9]} m
     * @returns {Float32Array}
     */
    mat.matrix3Aux = function (m) {
        var aux = _auxMatrices3[_auxMatrix3Index];
        aux.set(m);
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Return a 4x4 matrix comprised of the first 16 elements of the passed array.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array|Number[16]} m
     * @returns {Float32Array}
     */
    mat.matrix4Aux = function (m) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux.set(m);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a 4x4 transformation matrix describing a translation.
     * @param {Number} x The x coordinate of the translation.
     * @param {Number} y The y coordinate of the translation.
     * @param {Number} z The z coordinate of the translation.
     * @returns {Float32Array}
     */
    mat.translation4 = function (x, y, z) {
        _matrixCount++;
        return new Float32Array([
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            x, y, z, 1.0
        ]);
    };
    /**
     * Returns a 4x4 transformation matrix describing a translation.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} x The x coordinate of the translation.
     * @param {Number} y The y coordinate of the translation.
     * @param {Number} z The z coordinate of the translation.
     * @returns {Float32Array}
     */
    mat.translation4Aux = function (x, y, z) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = 1.0;
        aux[1] = 0.0;
        aux[2] = 0.0;
        aux[3] = 0.0;
        aux[4] = 0.0;
        aux[5] = 1.0;
        aux[6] = 0.0;
        aux[7] = 0.0;
        aux[8] = 0.0;
        aux[9] = 0.0;
        aux[10] = 1.0;
        aux[11] = 0.0;
        aux[12] = x;
        aux[13] = y;
        aux[14] = z;
        aux[15] = 1.0;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a 4x4 transformation matrix describing a translation.
     * @param {Number[3]} v The vector of the translation ([x,y,z]).
     * @returns {Float32Array}
     */
    mat.translation4v = function (v) {
        _matrixCount++;
        return new Float32Array([
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            v[0], v[1], v[2], 1.0
        ]);
    };
    /**
     * Returns a 4x4 transformation matrix describing a translation.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v The vector of the translation ([x,y,z]).
     * @returns {Float32Array}
     */
    mat.translation4vAux = function (v) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = 1.0;
        aux[1] = 0.0;
        aux[2] = 0.0;
        aux[3] = 0.0;
        aux[4] = 0.0;
        aux[5] = 1.0;
        aux[6] = 0.0;
        aux[7] = 0.0;
        aux[8] = 0.0;
        aux[9] = 0.0;
        aux[10] = 1.0;
        aux[11] = 0.0;
        aux[12] = v[0];
        aux[13] = v[1];
        aux[14] = v[2];
        aux[15] = 1.0;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a 4x4 transformation matrix describing a translation.
     * @param {Float32Array} m A generic 4x4 transformation matrix.
     * @returns {Float32Array}
     */
    mat.translation4m4 = function (m) {
        _matrixCount++;
        return new Float32Array([
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            m[12], m[13], m[14], 1.0
        ]);
    };
    /**
     * Returns a 4x4 transformation matrix describing a translation.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m A generic 4x4 transformation matrix the translation of which will be extracted.
     * @returns {Float32Array}
     */
    mat.translation4m4Aux = function (m) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = 1.0;
        aux[1] = 0.0;
        aux[2] = 0.0;
        aux[3] = 0.0;
        aux[4] = 0.0;
        aux[5] = 1.0;
        aux[6] = 0.0;
        aux[7] = 0.0;
        aux[8] = 0.0;
        aux[9] = 0.0;
        aux[10] = 1.0;
        aux[11] = 0.0;
        aux[12] = m[12];
        aux[13] = m[13];
        aux[14] = m[14];
        aux[15] = 1.0;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a new 2x2 transformation matrix describing a rotation.
     * @param {Number} angle The angle of rotation in radians
     */
    mat.rotation2 = function (angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        _matrixCount++;
        return new Float32Array([
            cosAngle, -sinAngle,
            sinAngle, cosAngle
        ]);
    };
    /**
     * Returns a new 3x3 transformation matrix describing a rotation around an arbitrary axis.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[]} axis An array of 3 numbers describing the axis of the rotation
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotation3Aux = function (axis, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle),
                aux = _auxMatrices3[_auxMatrix3Index];
        aux[0] = cosAngle + (1 - cosAngle) * axis[0] * axis[0];
        aux[1] = (1 - cosAngle) * axis[0] * axis[1] - sinAngle * axis[2];
        aux[2] = (1 - cosAngle) * axis[0] * axis[2] + sinAngle * axis[1];
        aux[3] = (1 - cosAngle) * axis[0] * axis[1] + sinAngle * axis[2];
        aux[4] = cosAngle + (1 - cosAngle) * axis[1] * axis[1];
        aux[5] = (1 - cosAngle) * axis[1] * axis[2] - sinAngle * axis[0];
        aux[6] = (1 - cosAngle) * axis[0] * axis[2] - sinAngle * axis[1];
        aux[7] = (1 - cosAngle) * axis[1] * axis[2] + sinAngle * axis[0];
        aux[8] = cosAngle + (1 - cosAngle) * axis[2] * axis[2];
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a new 4x4 transformation matrix describing a rotation around the X axis.
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotationX4 = function (angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        _matrixCount++;
        return new Float32Array([
            1, 0, 0, 0,
            0, cosAngle, -sinAngle, 0,
            0, sinAngle, cosAngle, 0,
            0, 0, 0, 1
        ]);
    };
    /**
     * A constant 4x4 rotation matrix, rotating +90 degrees around axis X.
     * @type Float32Array
     */
    mat.ROTATION_X_90 = mat.rotationX4(Math.PI * 0.5);
    /**
     * A constant 4x4 rotation matrix, rotating +180 degrees around axis X.
     * @type Float32Array
     */
    mat.ROTATION_X_180 = mat.rotationX4(Math.PI * 1.0);
    /**
     * A constant 4x4 rotation matrix, rotating +270 degrees around axis X.
     * @type Float32Array
     */
    mat.ROTATION_X_270 = mat.rotationX4(Math.PI * 1.5);
    /**
     * Returns a new 4x4 transformation matrix describing a rotation around the Y axis.
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotationY4 = function (angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        _matrixCount++;
        return new Float32Array([
            cosAngle, 0, sinAngle, 0,
            0, 1, 0, 0,
            -sinAngle, 0, cosAngle, 0,
            0, 0, 0, 1
        ]);
    };
    /**
     * A constant 4x4 rotation matrix, rotating +90 degrees around axis Y.
     * @type Float32Array
     */
    mat.ROTATION_Y_90 = mat.rotationY4(Math.PI * 0.5);
    /**
     * A constant 4x4 rotation matrix, rotating +180 degrees around axis Y.
     * @type Float32Array
     */
    mat.ROTATION_Y_180 = mat.rotationY4(Math.PI * 1.0);
    /**
     * A constant 4x4 rotation matrix, rotating +270 degrees around axis Y.
     * @type Float32Array
     */
    mat.ROTATION_Y_270 = mat.rotationY4(Math.PI * 1.5);
    /**
     * Returns a new 4x4 transformation matrix describing a rotation around the Z axis.
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotationZ4 = function (angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        _matrixCount++;
        return new Float32Array([
            cosAngle, -sinAngle, 0, 0,
            sinAngle, cosAngle, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    };
    /**
     * A constant 4x4 rotation matrix, rotating +90 degrees around axis Z.
     * @type Float32Array
     */
    mat.ROTATION_Z_90 = mat.rotationZ4(Math.PI * 0.5);
    /**
     * A constant 4x4 rotation matrix, rotating +180 degrees around axis Z.
     * @type Float32Array
     */
    mat.ROTATION_Z_180 = mat.rotationZ4(Math.PI * 1.0);
    /**
     * A constant 4x4 rotation matrix, rotating +270 degrees around axis Z.
     * @type Float32Array
     */
    mat.ROTATION_Z_270 = mat.rotationZ4(Math.PI * 1.5);
    /**
     * Returns a new 4x4 transformation matrix describing a rotation around an arbitrary axis.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[]} axis A 3D unit vector describing the axis of the rotation
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotation4Aux = function (axis, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle),
                aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = cosAngle + (1 - cosAngle) * axis[0] * axis[0];
        aux[1] = (1 - cosAngle) * axis[0] * axis[1] - sinAngle * axis[2];
        aux[2] = (1 - cosAngle) * axis[0] * axis[2] + sinAngle * axis[1];
        aux[3] = 0.0;
        aux[4] = (1 - cosAngle) * axis[0] * axis[1] + sinAngle * axis[2];
        aux[5] = cosAngle + (1 - cosAngle) * axis[1] * axis[1];
        aux[6] = (1 - cosAngle) * axis[1] * axis[2] - sinAngle * axis[0];
        aux[7] = 0.0;
        aux[8] = (1 - cosAngle) * axis[0] * axis[2] - sinAngle * axis[1];
        aux[9] = (1 - cosAngle) * axis[1] * axis[2] + sinAngle * axis[0];
        aux[10] = cosAngle + (1 - cosAngle) * axis[2] * axis[2];
        aux[11] = 0.0;
        aux[12] = 0.0;
        aux[13] = 0.0;
        aux[14] = 0.0;
        aux[15] = 1.0;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a new 4x4 transformation matrix describing a rotation around the X axis.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotationX4Aux = function (angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle),
                aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = 1;
        aux[1] = 0;
        aux[2] = 0;
        aux[3] = 0;
        aux[4] = 0;
        aux[5] = cosAngle;
        aux[6] = -sinAngle;
        aux[7] = 0;
        aux[8] = 0;
        aux[9] = sinAngle;
        aux[10] = cosAngle;
        aux[11] = 0;
        aux[12] = 0;
        aux[13] = 0;
        aux[14] = 0;
        aux[15] = 1;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a new 4x4 transformation matrix describing a rotation around the Z axis.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotationZ4Aux = function (angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle),
                aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = cosAngle;
        aux[1] = -sinAngle;
        aux[2] = 0;
        aux[3] = 0;
        aux[4] = sinAngle;
        aux[5] = cosAngle;
        aux[6] = 0;
        aux[7] = 0;
        aux[8] = 0;
        aux[9] = 0;
        aux[10] = 1;
        aux[11] = 0;
        aux[12] = 0;
        aux[13] = 0;
        aux[14] = 0;
        aux[15] = 1;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a 4x4 rotation matrix that has a Z axis pointing towards the given direction and a Y axis based on an optional second vector.
     * @param {Number[3]} direction A 3D unit vector.
     * @param {Number[3]} [up] A 3D unit vector.
     * @returns {Float32Array}
     */
    mat.lookTowards4 = function (direction, up) {
        var result;
        result = mat.identity4();
        mat.setLookTowards4(result, direction, up);
        return result;
    };
    /**
     * Returns a 4x4 rotation matrix that has a Z axis pointing towards the given direction and a Y axis based on an optional second vector.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} direction A 3D unit vector.
     * @param {Number[3]} [up] A 3D unit vector.
     * @returns {Float32Array}
     */
    mat.lookTowards4Aux = function (direction, up) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setLookTowards4(aux, direction, up);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a 4x4 transformation matrix describing a scaling along the 3 axes.
     * @param {Number} x Scaling along axis X.
     * @param {Number} [y] Scaling along axis Y. If omitted, the same scaling will
     * be used for all 3 axes.
     * @param {Number} [z] Scaling along axis Z. If omitted, the same scaling will
     * be used for all 3 axes.
     * @returns {Float32Array}
     */
    mat.scaling4 = function (x, y, z) {
        if (y === undefined) {
            y = x;
        }
        if (z === undefined) {
            z = x;
        }
        _matrixCount++;
        return new Float32Array([
            x, 0.0, 0.0, 0.0,
            0.0, y, 0.0, 0.0,
            0.0, 0.0, z, 0.0,
            0.0, 0.0, 0.0, 1.0]);
    };
    /**
     * Returns a 4x4 transformation matrix describing a scaling along the 3 axes.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} x Scaling along axis X.
     * @param {Number} [y] Scaling along axis Y. If omitted, the same scaling will
     * be used for all 3 axes.
     * @param {Number} [z] Scaling along axis Z. If omitted, the same scaling will
     * be used for all 3 axes.
     * @returns {Float32Array}
     */
    mat.scaling4Aux = function (x, y, z) {
        var aux = _auxMatrices[_auxMatrixIndex];
        if (y === undefined) {
            y = x;
        }
        if (z === undefined) {
            z = x;
        }
        aux[0] = x;
        aux[1] = 0;
        aux[2] = 0;
        aux[3] = 0;
        aux[4] = 0;
        aux[5] = y;
        aux[6] = 0;
        aux[7] = 0;
        aux[8] = 0;
        aux[9] = 0;
        aux[10] = z;
        aux[11] = 0;
        aux[12] = 0;
        aux[13] = 0;
        aux[14] = 0;
        aux[15] = 1;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * @param {Object[]} [jsonArray]
     */
    mat.rotation4FromJSON = function (jsonArray) {
        var i, axis, rotation, result = mat.identity4();
        if (jsonArray) {
            for (i = 0; i < jsonArray.length; i++) {
                // handle (convert) short notation of rotations
                rotation = ((typeof jsonArray[i]) === "string") ? {
                    axis: jsonArray[i][0],
                    degrees: parseFloat(jsonArray[i].substring(1))
                } : jsonArray[i];
                // process rotation
                if (typeof rotation.axis === "string") {
                    switch (rotation.axis) {
                        case "x":
                        case "X":
                            axis = vec.UNIT3_X;
                            break;
                        case "y":
                        case "Y":
                            axis = vec.UNIT3_Y;
                            break;
                        case "z":
                        case "Z":
                            axis = vec.UNIT3_Z;
                            break;
                    }
                } else if (rotation.axis instanceof Array) {
                    axis = rotation.axis;
                }
                mat.mulRotationRotation4(
                        result,
                        mat.rotation4Aux(
                                axis,
                                rotation.degrees * utils.RAD
                                )
                        );
            }
        }
        return result;
    };
    // -----------------------------------------------------------------------------
    // Functions of a single matrix
    /**
     * Returns the fourth row vector of a 4x4 matrix.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[4]}
     */
    mat.getRowD4 = function (m) {
        return [m[12], m[13], m[14], m[15]];
    };
    /**
     * Returns the determinant of the passed 3x3 matrix.
     * @param {Float32Array} m A 3x3 matrix.
     * @returns {Number} The determinant of m.
     */
    mat.determinant3 = function (m) {
        return (
                m[0] * m[4] * m[8] + m[1] * m[5] * m[6] + m[2] * m[3] * m[7] -
                m[2] * m[4] * m[6] - m[1] * m[3] * m[8] - m[0] * m[5] * m[7]
                );
    };
    /**
     * Returns the 3D vector corresponding to the translation the passed 4x4 matrix
     * describes.
     * @param {Float32Array} m A 4x4 transformation matrix.
     * @returns {Number[3]}
     */
    mat.translationVector3 = function (m) {
        return [m[12], m[13], m[14]];
    };
    /**
     * Returns the length of the vector of the translation described by the passed
     * 4x4 transformation matrix.
     * @param {Float32Array} m A 4x4 transformation matrix.
     * @returns {Number}
     */
    mat.translationLength = function (m) {
        return Math.sqrt(m[12] * m[12] + m[13] * m[13] + m[14] * m[14]);
    };
    /**
     * Takes a rotation matrix that was created as a product of two rotations, a first one around axis X and then one around axis Z, and 
     * returns the two angles corresponding to the two rotations. If the input matrix is not such a matrix (e.g. it was rotated around axis
     * Y as well), the result will not be accurate (and meaningful).
     * @param {Float32Array} m A 4x4 rotation matrix that is the combination (product) of a rotation first around axis X, then around axis Z.
     * @returns {Object} Has two fields, yaw is the angle of rotation around axis Z and pitch is the angle or rotation around axis X,
     * in radians.
     */
    mat.getYawAndPitch = function (m) {
        var pitchMatrix, result = {};
        if (Math.abs(m[6]) > CLOSE_TO_ONE_THRESHOLD) {
            result.yaw = 0;
            result.pitch = (m[6] > 0) ? -utils.HALF_PI : utils.HALF_PI;
        } else {
            result.yaw = (m[10] > 0) ? vec.angle2yCapped(m[4], m[5]) : vec.angle2yCapped(-m[4], -m[5]);
            if (m[4] * m[10] < 0) {
                result.yaw = -result.yaw;
            }
            pitchMatrix = mat.prod3x3SubOf4Aux(m, mat.rotationZ4Aux(-result.yaw));
            mat.correctOrthogonal4(pitchMatrix);
            result.pitch = vec.angle2xCapped(pitchMatrix[5], pitchMatrix[6]);
            if (pitchMatrix[6] > 0) {
                result.pitch = -result.pitch;
            }
        }
        return result;
    };
    /**
     * Returns the axes and angles (alpha and gamma) of two rotations that would transform the identity matrix into the passed rotation matrix.
     * @param {Float32Array} m A 4x4 rotation matrix.
     * @returns {Object} Has 4 fields: alpha and alphaAxis describe a rotation that would bring the Y axis of an identity matrix in line with
     * the Y axis of the passed matrix m, while gamma and gammaAxis describe a rotation that would afterwards bring the other axes in line.
     * The angles are in radian.
     */
    mat.getRotations = function (m) {
        var dot, halfMatrix, result = {};
        // calculate the rotation of axis Y needed
        dot = vec.dot3(vec.UNIT3_Y, vec.getRowB43Aux(m));
        // if the angle of the two Y vectors is (around) 0 or 180 degrees, their cross product will be of zero length
        // and we cannot use it as a rotation axis, therefore fall back to axis Z in this case
        if (Math.abs(dot) > CLOSE_TO_ONE_THRESHOLD) {
            result.alphaAxis = [0, 0, 1];
            result.alpha = dot > 0 ? 0 : Math.PI;
        } else {
            result.alphaAxis = vec.normalize3(vec.cross3(vec.getRowB43Aux(m), vec.UNIT3_Y));
            result.alpha = vec.angle3u(vec.getRowB43Aux(m), vec.UNIT3_Y);
        }
        if (result.alpha > Math.PI) {
            result.alpha -= utils.DOUBLE_PI;
        }
        // calculate the matrix we would get if we rotated the Y vector into position
        halfMatrix = mat.prod3x3SubOf43Aux(m, mat.rotation3Aux(result.alphaAxis, -result.alpha));
        mat.correctOrthogonal4(halfMatrix);
        // X and Z vectors might still be out of place, therefore do the same calculations as before to 
        // get the second rotation needed, which will put all vectors in place
        dot = vec.dot3(vec.UNIT3_X, vec.getRowA43Aux(halfMatrix));
        if (Math.abs(dot) > CLOSE_TO_ONE_THRESHOLD) {
            result.gammaAxis = [0, 1, 0];
            result.gamma = dot > 0 ? 0 : Math.PI;
        } else {
            result.gammaAxis = vec.normalize3(vec.cross3(vec.getRowA43Aux(halfMatrix), vec.UNIT3_X));
            result.gamma = vec.angle3u(vec.getRowA43Aux(halfMatrix), vec.UNIT3_X);
        }
        if (result.gamma > Math.PI) {
            result.gamma -= utils.DOUBLE_PI;
        }
        return result;
    };
    /**
     * Returns the string representation of a 3x3 matrix.
     * @param {Float32Array} m A 3x3 matrix.
     * @param {Number} [d=2] The number of decimals to include in the string for the 
     * matrix components.
     * @returns {String}
     */
    mat.toString3 = function (m, d) {
        d = d || 2;
        return m[0].toFixed(d) + " " + m[1].toFixed(d) + " " + m[2].toFixed(d) + "\n" +
                m[3].toFixed(d) + " " + m[4].toFixed(d) + " " + m[5].toFixed(d) + "\n" +
                m[6].toFixed(d) + " " + m[7].toFixed(d) + " " + m[8].toFixed(d);
    };
    /**
     * Returns the string representation of a 4x4 matrix.
     * @param {Float32Array} m A 4x4 matrix.
     * @param {Number} [d=2] The number of decimals to include in the string for the 
     * matrix components.
     * @returns {String}
     */
    mat.toString4 = function (m, d) {
        d = d || 2;
        return m[0].toFixed(d) + " " + m[1].toFixed(d) + " " + m[2].toFixed(d) + " " + m[3].toFixed(d) + "\n" +
                m[4].toFixed(d) + " " + m[5].toFixed(d) + " " + m[6].toFixed(d) + " " + m[7].toFixed(d) + "\n" +
                m[8].toFixed(d) + " " + m[9].toFixed(d) + " " + m[10].toFixed(d) + " " + m[11].toFixed(d) + "\n" +
                m[12].toFixed(d) + " " + m[13].toFixed(d) + " " + m[14].toFixed(d) + " " + m[15].toFixed(d);
    };
    /**
     * Returns the string representation of a 4x4 matrix, with HTML markup to indicate
     * line breaks.
     * @param {Float32Array} m A 4x4 matrix.
     * @param {Number} [d=2] The number of decimals to include in the string for the 
     * matrix components.
     * @returns {String}
     */
    mat.toHTMLString4 = function (m, d) {
        d = d || 2;
        return m[0].toFixed(d) + " " + m[1].toFixed(d) + " " + m[2].toFixed(d) + " " + m[3].toFixed(d) + "<br/>" +
                m[4].toFixed(d) + " " + m[5].toFixed(d) + " " + m[6].toFixed(d) + " " + m[7].toFixed(d) + "<br/>" +
                m[8].toFixed(d) + " " + m[9].toFixed(d) + " " + m[10].toFixed(d) + " " + m[11].toFixed(d) + "<br/>" +
                m[12].toFixed(d) + " " + m[13].toFixed(d) + " " + m[14].toFixed(d) + " " + m[15].toFixed(d);
    };
    // -----------------------------------------------------------------------------
    // Functions that transform a matrix
    /**
     * Returns the 3x3 top-left submatrix of the passed 4x4 matrix.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Float32Array}
     */
    mat.matrix3from4Aux = function (m) {
        var aux = _auxMatrices3[_auxMatrix3Index];
        aux[0] = m[0];
        aux[1] = m[1];
        aux[2] = m[2];
        aux[3] = m[4];
        aux[4] = m[5];
        aux[5] = m[6];
        aux[6] = m[8];
        aux[7] = m[9];
        aux[8] = m[10];
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns the transposed of the passed 3x3 matrix m.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m A 3x3 matrix.
     * @returns {Float32Array} The transposed of m.
     */
    mat.transposed3Aux = function (m) {
        var aux = _auxMatrices3[_auxMatrix3Index];
        mat.setTransposed3(aux, m);
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns the transposed of the passed 4x4 matrix m.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Float32Array} The transposed of m.
     */
    mat.transposed4 = function (m) {
        _matrixCount++;
        return new Float32Array([
            m[0], m[4], m[8], m[12],
            m[1], m[5], m[9], m[13],
            m[2], m[6], m[10], m[14],
            m[3], m[7], m[11], m[15]
        ]);
    };
    /**
     * Returns the transposed of the passed 4x4 matrix m.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Float32Array} The transposed of m.
     */
    mat.transposed4Aux = function (m) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setTransposed4(aux, m);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Transposes the passed 3x3 matrix, modifying it in-place.
     * @param {Float32Array} m
     */
    mat.transpose3 = function (m) {
        var m1 = m[1], m2 = m[2], m5 = m[5];
        m[1] = m[3];
        m[3] = m1;
        m[2] = m[6];
        m[6] = m2;
        m[5] = m[7];
        m[7] = m5;
    };
    /**
     * Returns the inverse of the passed 3x3 matrix m.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m A 3x3 matrix.
     * @returns {Float32Array} The inverse of m.
     */
    mat.inverse3Aux = function (m) {
        var aux = _auxMatrices3[_auxMatrix3Index];
        mat.setInverse3(aux, m);
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns the inverse of the passed 4x4 matrix m.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Float32Array} The inverse of m.
     */
    mat.inverse4Aux = function (m) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setInverse4(aux, m);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * A computationally efficient function to return the inverse of a 4x4 translation
     * matrix. (a transformation matrix that only hold translation information)
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m The input 4x4 matrix.
     * @returns {Float32Array} The calculated inverse 4x4 matrix.
     */
    mat.inverseOfTranslation4Aux = function (m) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setInverseOfTranslation4(aux, m);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Calculates and returns the inverse of a 4x4 rotation matrix, using the fact that
     * it coincides with its transpose. It is the same as transposed4, but the different
     * name of the function can clarify the role of it when it is used.
     * @param {Float32Array} m The input 4x4 rotation matrix.
     * @returns {Float32Array} The calculated inverse (transpose) rotation matrix.
     */
    mat.inverseOfRotation4 = mat.transposed4;
    /**
     * Calculates and returns the inverse of a 4x4 rotation matrix, using the fact that
     * it coincides with its transpose. It is the same as transposed4, but the different
     * name of the function can clarify the role of it when it is used.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m The input 4x4 rotation matrix.
     * @returns {Float32Array} The calculated inverse (transpose) rotation matrix.
     */
    mat.inverseOfRotation4Aux = mat.transposed4Aux;
    // -----------------------------------------------------------------------------
    // Functions and operations with two matrices
    /**
     * Returns whether the passed two 4x4 matrices are equal.
     * @param {Float32Array} m1 The first 4x4 matrix.
     * @param {Float32Array} m2 The second 4x4 matrix.
     * @returns {Boolean}
     */
    mat.equal4 = function (m1, m2) {
        return (
                m1[0] === m2[0] &&
                m1[1] === m2[1] &&
                m1[2] === m2[2] &&
                m1[3] === m2[3] &&
                m1[4] === m2[4] &&
                m1[5] === m2[5] &&
                m1[6] === m2[6] &&
                m1[7] === m2[7] &&
                m1[8] === m2[8] &&
                m1[9] === m2[9] &&
                m1[10] === m2[10] &&
                m1[11] === m2[11] &&
                m1[12] === m2[12] &&
                m1[13] === m2[13] &&
                m1[14] === m2[14] &&
                m1[15] === m2[15]);
    };
    /**
     * Multiplies two 4x4 matrices and returns the result.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m1 The left matrix.
     * @param {Float32Array} m2 The right matrix.
     * @returns {Float32Array} A 4x4 matrix. (one of the auxiliary matrices!)
     */
    mat.prod4Aux = function (m1, m2) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setProd4(aux, m1, m2);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Multiplies the upper left 3x3 submatrices of two 4x4 matrices and returns the result padded to a 4x4 matrix.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m1 The 4x4 matrix on the left of the multiplicaton.
     * @param {Float32Array} m2 The 4x4 matrix on the right of the multiplicaton.
     * @returns {Float32Array} A 4x4 matrix. (one of the auxiliary matrices!)
     */
    mat.prod3x3SubOf4Aux = function (m1, m2) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8];
        aux[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9];
        aux[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10];
        aux[3] = 0;
        aux[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8];
        aux[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9];
        aux[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10];
        aux[7] = 0;
        aux[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8];
        aux[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9];
        aux[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10];
        aux[11] = 0;
        aux[12] = 0;
        aux[13] = 0;
        aux[14] = 0;
        aux[15] = 1;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns a 4x4 rotation matrix with uniform scaling applied.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} scale The uniform scaling factor to apply.
     * @param {Float32Array} rm The 4x4 rotation matrix to scale.
     * @returns {Float32Array} A 4x4 matrix. (one of the auxiliary matrices!)
     */
    mat.scaledRotationAux = function (scale, rm) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = scale * rm[0];
        aux[1] = scale * rm[1];
        aux[2] = scale * rm[2];
        aux[3] = 0;
        aux[4] = scale * rm[4];
        aux[5] = scale * rm[5];
        aux[6] = scale * rm[6];
        aux[7] = 0;
        aux[8] = scale * rm[8];
        aux[9] = scale * rm[9];
        aux[10] = scale * rm[10];
        aux[11] = 0;
        aux[12] = 0;
        aux[13] = 0;
        aux[14] = 0;
        aux[15] = 1;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Multiplies a 4x4 scaling matrix with a 4x4 rotation matrix and returns the upper left 3x3 submatrix of the result.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} sm The 4x4 scaling matrix on the left of the multiplicaton.
     * @param {Float32Array} rm The 4x4 rotation matrix on the right of the multiplicaton.
     * @returns {Float32Array} A 3x3 matrix. (one of the auxiliary matrices!)
     */
    mat.prodScalingRotation3Aux = function (sm, rm) {
        var aux = _auxMatrices3[_auxMatrix3Index];
        aux[0] = sm[0] * rm[0];
        aux[1] = sm[0] * rm[1];
        aux[2] = sm[0] * rm[2];
        aux[3] = sm[5] * rm[4];
        aux[4] = sm[5] * rm[5];
        aux[5] = sm[5] * rm[6];
        aux[6] = sm[10] * rm[8];
        aux[7] = sm[10] * rm[9];
        aux[8] = sm[10] * rm[10];
        _auxMatrix3Index = (_auxMatrix3Index + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Multiplies the upper left 3x3 submatrix of the 4x4 matrix with the 3x3 matrix and returns the result padded to a 4x4 matrix.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m4 The 4x4 matrix on the left of the multiplicaton.
     * @param {Float32Array} m3 The 3x3 matrix on the right of the multiplicaton.
     * @returns {Float32Array} A 4x4 matrix. (one of the auxiliary matrices!)
     */
    mat.prod3x3SubOf43Aux = function (m4, m3) {
        var aux = _auxMatrices[_auxMatrixIndex];
        aux[0] = m4[0] * m3[0] + m4[1] * m3[3] + m4[2] * m3[6];
        aux[1] = m4[0] * m3[1] + m4[1] * m3[4] + m4[2] * m3[7];
        aux[2] = m4[0] * m3[2] + m4[1] * m3[5] + m4[2] * m3[8];
        aux[3] = 0;
        aux[4] = m4[4] * m3[0] + m4[5] * m3[3] + m4[6] * m3[6];
        aux[5] = m4[4] * m3[1] + m4[5] * m3[4] + m4[6] * m3[7];
        aux[6] = m4[4] * m3[2] + m4[5] * m3[5] + m4[6] * m3[8];
        aux[7] = 0;
        aux[8] = m4[8] * m3[0] + m4[9] * m3[3] + m4[10] * m3[6];
        aux[9] = m4[8] * m3[1] + m4[9] * m3[4] + m4[10] * m3[7];
        aux[10] = m4[8] * m3[2] + m4[9] * m3[5] + m4[10] * m3[8];
        aux[11] = 0;
        aux[12] = 0;
        aux[13] = 0;
        aux[14] = 0;
        aux[15] = 1;
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Performs an optimized multiplication of two matrices using the assumption that the left matrix is a translation matrix and the right
     * matrix if a rotation (or scaled rotation, but without projection or translation) matrix.
     * @param {Float32Array} t A 4x4 translation matrix, without rotation, scaling or projection.
     * @param {Float32Array} r A 4x4 rotation or scaling and rotation matrix, without translation or projection.
     * @returns {Float32Array} The product of the two matrices.
     */
    mat.prodTranslationRotation4 = function (t, r) {
        _matrixCount++;
        return new Float32Array([
            r[0], r[1], r[2], 0,
            r[4], r[5], r[6], 0,
            r[8], r[9], r[10], 0,
            r[0] * t[12] + r[4] * t[13] + r[8] * t[14],
            r[1] * t[12] + r[5] * t[13] + r[9] * t[14],
            r[2] * t[12] + r[6] * t[13] + r[10] * t[14],
            1
        ]);
    };
    /**
     * Performs an optimized multiplication of two matrices using the assumption that the left matrix is a translation matrix and the right
     * matrix if a rotation (or scaled rotation, but without projection or translation) matrix.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} t A 4x4 translation matrix, without rotation, scaling or projection.
     * @param {Float32Array} r A 4x4 rotation or scaling and rotation matrix, without translation or projection.
     * @returns {Float32Array} The product of the two matrices.
     */
    mat.prodTranslationRotation4Aux = function (t, r) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setProdTranslationRotation4(aux, t, r);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Multiplies three 4x4 matrices and returns the result.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m1 The first (leftmost) 4x4 matrix
     * @param {Float32Array} m2 The second (middle) 4x4 matrix
     * @param {Float32Array} m3 The third (rightmost) 4x4 matrix
     * @returns {Float32Array}
     */
    mat.prod34Aux = function (m1, m2, m3) {
        var result = mat.prod4Aux(m1, m2);
        mat.mul4(result, m3);
        return result;
    };
    /**
     * Returns a 4x4 transformation matrix, which is the result of translating m1 by the translation described by m2.
     * Uses one of the auxiliary matrices instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m1 A 4x4 transformation matrix.
     * @param {Float32Array} m2 A 4x4 transformation matrix. Only the translation described in this matrix will be taken into account.
     * @returns {Float32Array}
     */
    mat.translatedByM4Aux = function (m1, m2) {
        var aux = _auxMatrices[_auxMatrixIndex];
        mat.setTranslatedByM4(aux, m1, m2);
        _auxMatrixIndex = (_auxMatrixIndex + 1) % AUX_MATRIX_COUNT;
        return aux;
    };
    /**
     * Returns the square of the distance between the translations described by the
     * two given 4x4 transformation matrices. Transformations other than translations
     * are ignored.
     * @param {Float32Array} m1 A 4x4 transformation matrix.
     * @param {Float32Array} m2 Another 4x4 transformation matrix.
     * @returns {Number}
     */
    mat.distanceSquared = function (m1, m2) {
        return (
                (m1[12] - m2[12]) * (m1[12] - m2[12]) +
                (m1[13] - m2[13]) * (m1[13] - m2[13]) +
                (m1[14] - m2[14]) * (m1[14] - m2[14])
                );
    };
    // -----------------------------------------------------------------------------
    // Functions that modify existing matrices
    /**
     * Modifies the passed 3x3 matrix, setting it to an identity matrix.
     * @param {Float32Array} m A 3x3 matrix
     */
    mat.setIdentity3 = function (m) {
        m[0] = 1;
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        m[4] = 1;
        m[5] = 0;
        m[6] = 0;
        m[7] = 0;
        m[8] = 1;
    };
    /**
     * Sets the passed 4x4 matrix m to a 4x4 identity matrix.
     * @param {Float32Array} m
     */
    mat.setIdentity4 = function (m) {
        m[0] = 1;
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        m[4] = 0;
        m[5] = 1;
        m[6] = 0;
        m[7] = 0;
        m[8] = 0;
        m[9] = 0;
        m[10] = 1;
        m[11] = 0;
        m[12] = 0;
        m[13] = 0;
        m[14] = 0;
        m[15] = 1;
    };
    /**
     * Sets the value of a 3x3 matrix to that of another 3x3 matrix, without creating a new
     * matrix or modifying the reference itself. (copies the value over instead)
     * @param {Float32Array} left The leftvalue, a 3x3 matrix
     * @param {Float32Array} right The rightvalue, a 3x3 matrix
     */
    mat.setMatrix3 = function (left, right) {
        var i;
        for (i = 0; i < 9; i++) {
            left[i] = right[i];
        }
    };
    /**
     * Sets the value of a 4x4 matrix to that of another 4x4 matrix, without creating a new
     * matrix or modifying the reference itself. (copies the value over instead)
     * @param {Float32Array} left The leftvalue, a 4x4 matrix
     * @param {Float32Array} right The rightvalue, a 4x4 matrix
     */
    mat.setMatrix4 = function (left, right) {
        var i;
        for (i = 0; i < 16; i++) {
            left[i] = right[i];
        }
    };
    /**
     * Copies the value of the right 4x4 translation matrix into the left 4x4 translation matrix
     * @param {Float32Array} left The leftvalue, a 4x4 translation matrix
     * @param {Float32Array} right The rightvalue, a 4x4 translation matrix
     */
    mat.copyTranslation4 = function (left, right) {
        left[12] = right[12];
        left[13] = right[13];
        left[14] = right[14];
    };
    /**
     * Copies the value of the right 4x4 rotation matrix into the left 4x4 rotation matrix
     * @param {Float32Array} left The leftvalue, a 4x4 rotation matrix
     * @param {Float32Array} right The rightvalue, a 4x4 rotation matrix
     */
    mat.copyRotation4 = function (left, right) {
        left[0] = right[0];
        left[1] = right[1];
        left[2] = right[2];
        left[4] = right[4];
        left[5] = right[5];
        left[6] = right[6];
        left[8] = right[8];
        left[9] = right[9];
        left[10] = right[10];
    };
    /**
     * Copies the value of the right 4x4 scaling matrix into the left 4x4 scaling matrix
     * @param {Float32Array} left The leftvalue, a 4x4 scaling matrix
     * @param {Float32Array} right The rightvalue, a 4x4 scaling matrix
     */
    mat.copyScaling4 = function (left, right) {
        left[0] = right[0];
        left[5] = right[5];
        left[10] = right[10];
    };
    /**
     * Sets the components of a 4x4 translation matrix to correspond to a translation defined by the passed vector.
     * @param {Float32Array} m
     * @param {Number[3]} v The vector of the translation ([x,y,z]).
     * @returns {Float32Array}
     */
    mat.updateTranslation4v = function (m, v) {
        m[12] = v[0];
        m[13] = v[1];
        m[14] = v[2];
    };
    /**
     * Modifies a 2x2 transformation matrix to describe a rotation.
     * @param {Float32Array} m The 2x2 matrix to modify
     * @param {Number} angle The angle of rotation in radians
     */
    mat.setRotation2 = function (m, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        m[0] = cosAngle;
        m[1] = -sinAngle;
        m[2] = sinAngle;
        m[3] = cosAngle;
    };
    /**
     * Modifies the 3x3 matrix m in-place, setting it to a 3x3 rotation matrix.
     * @param {Float32Array} m The 3x3 matrix to modify
     * @param {Number[]} axis An array of 3 numbers describing the axis of the rotation
     * @param {Number} angle The angle of rotation in radian
     */
    mat.setRotation3 = function (m, axis, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        m[0] = cosAngle + (1 - cosAngle) * axis[0] * axis[0];
        m[1] = (1 - cosAngle) * axis[0] * axis[1] - sinAngle * axis[2];
        m[2] = (1 - cosAngle) * axis[0] * axis[2] + sinAngle * axis[1];
        m[3] = (1 - cosAngle) * axis[0] * axis[1] + sinAngle * axis[2];
        m[4] = cosAngle + (1 - cosAngle) * axis[1] * axis[1];
        m[5] = (1 - cosAngle) * axis[1] * axis[2] - sinAngle * axis[0];
        m[6] = (1 - cosAngle) * axis[0] * axis[2] - sinAngle * axis[1];
        m[7] = (1 - cosAngle) * axis[1] * axis[2] + sinAngle * axis[0];
        m[8] = cosAngle + (1 - cosAngle) * axis[2] * axis[2];
    };
    /**
     * Modifies the 4x4 matrix m in-place, setting it to a 4x4 rotation matrix.
     * @param {Float32Array} m The 4x4 matrix to modify
     * @param {Number[]} axis An array of 3 numbers describing the axis of the rotation
     * @param {Number} angle The angle of rotation in radian
     */
    mat.setRotation4 = function (m, axis, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle);
        m[0] = cosAngle + (1 - cosAngle) * axis[0] * axis[0];
        m[1] = (1 - cosAngle) * axis[0] * axis[1] - sinAngle * axis[2];
        m[2] = (1 - cosAngle) * axis[0] * axis[2] + sinAngle * axis[1];
        m[3] = 0.0;
        m[4] = (1 - cosAngle) * axis[0] * axis[1] + sinAngle * axis[2];
        m[5] = cosAngle + (1 - cosAngle) * axis[1] * axis[1];
        m[6] = (1 - cosAngle) * axis[1] * axis[2] - sinAngle * axis[0];
        m[7] = 0.0;
        m[8] = (1 - cosAngle) * axis[0] * axis[2] - sinAngle * axis[1];
        m[9] = (1 - cosAngle) * axis[1] * axis[2] + sinAngle * axis[0];
        m[10] = cosAngle + (1 - cosAngle) * axis[2] * axis[2];
        m[11] = 0.0;
        m[12] = 0.0;
        m[13] = 0.0;
        m[14] = 0.0;
        m[15] = 1.0;
    };
    /**
     * Modifies the matrix m in-place, setting it to a 4x4 transformation matrix describing a rotation around an arbitrary axis that goes 
     * through a given point.
     * @param {Float32Array} m
     * @param {Number[3]} p The axis of rotation passes through this point.
     * @param {Number[]} axis A 3D unit vector describing the direction of the axis.
     * @param {Number} angle The angle of rotation in radians
     * @returns {Float32Array}
     */
    mat.setRotationAroundPoint4 = function (m, p, axis, angle) {
        var p2;
        mat.setRotation4(m, axis, angle);
        p2 = vec.prodVec3Mat4Aux(p, m);
        m[12] = p[0] - p2[0];
        m[13] = p[1] - p2[1];
        m[14] = p[2] - p2[2];
    };
    /**
     * Modifies a 4x4 matrix, setting it so that its Z axis points towards the given direction and the Y axis is based on an optional second vector.
     * @param {Float32Array} m The 4x4 matrix to modify
     * @param {Number[3]} direction A 3D unit vector.
     * @param {Number[3]} [up] A 3D unit vector.
     */
    mat.setLookTowards4 = function (m, direction, up) {
        var right;
        up = up || [0, 1, 0];
        if (Math.abs(vec.dot3(up, direction)) > CLOSE_TO_ONE_THRESHOLD) {
            up = vec.perpendicular3(direction);
        }
        right = vec.cross3Aux(up, direction);
        m[0] = right[0];
        m[1] = right[1];
        m[2] = right[2];
        up = vec.cross3Aux(direction, right);
        m[4] = up[0];
        m[5] = up[1];
        m[6] = up[2];
        mat.correctOrthogonal4(m);
    };
    /**
     * Applies a translation to the passed 4x4 transformation matrix described by the passed
     * 3D vector.
     * @param {Float32Array} m A 4x4 matrix
     * @param {Number[3]} v A 3D vector
     */
    mat.translateByVector = function (m, v) {
        m[12] += v[0];
        m[13] += v[1];
        m[14] += v[2];
    };
    /**
     * Applies a translation to the passed 4x4 transformation matrix described by the second
     * passed transformation matrix, which is treated like a translation matrix (other parts
     * of the matrix are not considered)
     * @param {Float32Array} m A 4x4 matrix
     * @param {Float32Array} n A 4x4 translation matrix
     */
    mat.translateByMatrix = function (m, n) {
        m[12] += n[12];
        m[13] += n[13];
        m[14] += n[14];
    };
    /**
     * Applies a translation to the passed 4x4 transformation matrix described by the second
     * passed transformation matrix, which is treated like a translation matrix (other parts
     * of the matrix are not considered), multiplied by a scalar.
     * @param {Float32Array} m A 4x4 matrix
     * @param {Float32Array} n A 4x4 translation matrix
     * @param {Number} s The scalar to multiply with
     */
    mat.translateByMatrixMul = function (m, n, s) {
        m[12] += n[12] * s;
        m[13] += n[13] * s;
        m[14] += n[14] * s;
    };
    /**
     * Modifies the passed 4x4 transformation matrix m in-place to be rotated around the given axis by the given angle.
     * @param {Float32Array} m The matrix to modify
     * @param {Number[]} axis An array of 3 numbers describing the axis of the rotation
     * @param {Number} angle The angle of rotation in radian
     */
    mat.rotate4 = function (m, axis, angle) {
        var
                index = _getFreeTempMatrixIndex(),
                rot = _getTempMatrix(index);
        mat.setRotation3(rot, axis, angle);
        mat.mul43(m, rot);
        _releaseTempMatrix(index);
    };
    /**
     * Modifies the passed 4x4 transformation matrix m in-place to be rotated by the given angle around the given axis that goes through the 
     * given point.
     * @param {Float32Array} m
     * @param {Number[3]} p The axis of rotation passes through this point.
     * @param {Number[]} axis A 3D unit vector describing the direction of the axis.
     * @param {Number} angle The angle of rotation in radians
     * @returns {Float32Array}
     */
    mat.rotateAroundPoint4 = function (m, p, axis, angle) {
        var
                index = _getFreeTempMatrixIndex(),
                rot = _getTempMatrix(index);
        mat.setRotationAroundPoint4(rot, p, axis, angle);
        mat.mul4(m, rot);
        _releaseTempMatrix(index);
    };
    /**
     * Modifies the passed 3x3 transformation matrix m in-place to be the inverse of the passed 3x3 matrix im.
     * @param {Float32Array} m The 3x3 matrix to modify
     * @param {Float32Array} im The 3x3 matrix the inverse of which is sought
     */
    mat.setInverse3 = function (m, im) {
        var i, j, k, t, u, m2, swap, index = _getFreeTempMatrixIndex();
        m2 = _getTempMatrix(index);
        mat.setMatrix3(m2, im);
        // we will use Gauss-Jordan elimination, so an identity matrix will be augmented to
        // the right of the original matrix
        mat.setIdentity3(m);
        // check by the determinant, if the matrix is invertible
        if (mat.determinant3(m2) === 0) {
            return;
        }
        // calculate the inverse by Gaussian-Jordan elimination
        // first part: forward elimination
        // for each row...
        for (i = 0; i < 3; i++) {
            // first swap the row to have a non-zero element at the diagonal
            // position, if needed
            if (Math.abs(m2[i * 4]) <= 0.0001) {
                // first, find a non-zero element in the same (i) column
                j = i + 1;
                while (Math.abs(m2[j * 3 + i]) <= 0.0001) {
                    j++;
                }
                // when found it in row 'j' swap the 'i'th and 'j'th rows
                for (k = 0; k < 3; k++) {
                    swap = m2[i * 3 + k];
                    m2[i * 3 + k] = m2[j * 3 + k];
                    m2[j * 3 + k] = swap;
                    swap = m[i * 3 + k];
                    m[i * 3 + k] = m[j * 3 + k];
                    m[j * 3 + k] = swap;
                }
            }
            // divide all elements of the row by the value of the element in the
            // main diagonal (within that row), to make it equal one
            t = m2[i * 4];
            for (j = 0; j < 3; j++) {
                m2[i * 3 + j] = m2[i * 3 + j] / t;
                m[i * 3 + j] = m[i * 3 + j] / t;
            }
            // subtract the row from all rows below it, multiplied accordingly
            // to null out the elements below the main diagonal element
            for (j = i + 1; j < 3; j++) {
                u = m2[j * 3 + i] / m2[i * 4];
                for (k = 0; k < 3; k++) {
                    m2[j * 3 + k] = m2[j * 3 + k] - u * m2[i * 3 + k];
                    m[j * 3 + k] = m[j * 3 + k] - u * m[i * 3 + k];
                }
            }
        }
        // back-substitution phase: eliminate the upper part of the original
        // matrix - however, these final values hold no additional information
        // for the calculations, so the operations are only done on the right
        // matrix, which will hold the inverse in the end
        for (i = 2; i >= 1; i--) {
            for (j = i - 1; j >= 0; j--) {
                for (k = 0; k < 3; k++) {
                    m[j * 3 + k] = m[j * 3 + k] - m2[j * 3 + i] * m[i * 3 + k];
                }
            }
        }
        _releaseTempMatrix(index);
    };
    /**
     * Modifies the passed 4x4 transformation matrix m in-place to be the inverse of the passed 4x4 matrix im.
     * @param {Float32Array} m The 4x4 matrix to modify
     * @param {Float32Array} im The 4x4 matrix the inverse of which is sought
     */
    mat.setInverse4 = function (m, im) {
        var i, j, k, t, u, m2, swap, index = _getFreeTempMatrixIndex();
        m2 = _getTempMatrix(index);
        mat.setMatrix4(m2, im);
        // we will use Gauss-Jordan elimination, so an identity matrix will be augmented to
        // the right of the original matrix
        mat.setIdentity4(m);
        // we assume that the matrix is invertible (for efficiency, and since in all
        // uses cases it should be)
        // calculate the inverse by Gaussian-Jordan elimination
        // first part: forward elimination
        // for each row...
        for (i = 0; i < 4; i++) {
            // first swap the row to have a non-zero element at the diagonal
            // position, if needed
            if (Math.abs(m2[i * 5]) <= 0.0001) {
                // first, find a non-zero element in the same (i) column
                j = i + 1;
                while (Math.abs(m2[j * 4 + i]) <= 0.0001) {
                    j++;
                }
                // when found it in row 'j' swap the 'i'th and 'j'th rows
                for (k = 0; k < 4; k++) {
                    swap = m2[i * 4 + k];
                    m2[i * 4 + k] = m2[j * 4 + k];
                    m2[j * 4 + k] = swap;
                    swap = m[i * 4 + k];
                    m[i * 4 + k] = m[j * 4 + k];
                    m[j * 4 + k] = swap;
                }
            }
            // divide all elements of the row by the value of the element in the
            // main diagonal (within that row), to make it equal one
            t = m2[i * 5];
            for (j = 0; j < 4; j++) {
                m2[i * 4 + j] = m2[i * 4 + j] / t;
                m[i * 4 + j] = m[i * 4 + j] / t;
            }
            // subtract the row from all rows below it, multiplied accordingly
            // to null out the elements below the main diagonal element
            for (j = i + 1; j < 4; j++) {
                u = m2[j * 4 + i] / m2[i * 5];
                for (k = 0; k < 4; k++) {
                    m2[j * 4 + k] = m2[j * 4 + k] - u * m2[i * 4 + k];
                    m[j * 4 + k] = m[j * 4 + k] - u * m[i * 4 + k];
                }
            }
        }
        // back-substitution phase: eliminate the upper part of the original
        // matrix - however, these final values hold no additional information
        // for the calculations, so the operations are only done on the right
        // matrix, which will hold the inverse in the end
        for (i = 3; i >= 1; i--) {
            for (j = i - 1; j >= 0; j--) {
                for (k = 0; k < 4; k++) {
                    m[j * 4 + k] = m[j * 4 + k] - m2[j * 4 + i] * m[i * 4 + k];
                }
            }
        }
        _releaseTempMatrix(index);
    };
    /**
     * A computationally efficient function to set a 4x4 matrix to be the inverse of a 4x4 translation
     * matrix. (a transformation matrix that only holds translation information)
     * @param {Float32Array} m The 4x4 matrix to set
     * @param {Float32Array} tm The input 4x4 matrix.
     */
    mat.setInverseOfTranslation4 = function (m, tm) {
        m[0] = 1.0;
        m[1] = 0.0;
        m[2] = 0.0;
        m[3] = 0.0;
        m[4] = 0.0;
        m[5] = 1.0;
        m[6] = 0.0;
        m[7] = 0.0;
        m[8] = 0.0;
        m[9] = 0.0;
        m[10] = 1.0;
        m[11] = 0.0;
        m[12] = -tm[12];
        m[13] = -tm[13];
        m[14] = -tm[14];
        m[15] = 1.0;
    };
    /**
     * Modifies the passed matrix in-place to be the transposed of the other passed 3x3 matrix
     * @param {Float32Array} m The 3x3 matrix to modify
     * @param {Float32Array} tm The 3x3 matrix to transpose
     */
    mat.setTransposed3 = function (m, tm) {
        m[0] = tm[0];
        m[1] = tm[3];
        m[2] = tm[6];
        m[3] = tm[1];
        m[4] = tm[4];
        m[5] = tm[7];
        m[6] = tm[2];
        m[7] = tm[5];
        m[8] = tm[8];
    };
    /**
     * Modifies the passed matrix in-place to be the transposed of the other passed 4x4 matrix
     * @param {Float32Array} m The 4x4 matrix to modify
     * @param {Float32Array} tm The 4x4 matrix to transpose
     */
    mat.setTransposed4 = function (m, tm) {
        m[0] = tm[0];
        m[1] = tm[4];
        m[2] = tm[8];
        m[3] = tm[12];
        m[4] = tm[1];
        m[5] = tm[5];
        m[6] = tm[9];
        m[7] = tm[13];
        m[8] = tm[2];
        m[9] = tm[6];
        m[10] = tm[10];
        m[11] = tm[14];
        m[12] = tm[3];
        m[13] = tm[7];
        m[14] = tm[11];
        m[15] = tm[15];
    };
    /**
     * Modifies the passed matrix in-place to be the the inverse of a 4x4 rotation matrix, using the fact that
     * it coincides with its transpose. It is the same as setTransposed4, but the different
     * name of the function can clarify the role of it when it is used.
     * @param {Float32Array} m The 4x4 matrix to modify
     * @param {Float32Array} tm The 4x4 matrix to invert
     */
    mat.setInverseOfRotation4 = mat.setTransposed4;
    /**
     * Multiples the given 3x3 matrix m1 in place by the 3x3 matrix m2 from the right.
     * @param {Float32Array} m1
     * @param {Float32Array} m2
     */
    mat.mul3 = function (m1, m2) {
        var
                index = _getFreeTempMatrixIndex(),
                mt = _getTempMatrix(index);
        mat.setMatrix3(mt, m1);
        m1[0] = mt[0] * m2[0] + mt[1] * m2[3] + mt[2] * m2[6];
        m1[1] = mt[0] * m2[1] + mt[1] * m2[4] + mt[2] * m2[7];
        m1[2] = mt[0] * m2[2] + mt[1] * m2[5] + mt[2] * m2[8];
        m1[3] = mt[3] * m2[0] + mt[4] * m2[3] + mt[5] * m2[6];
        m1[4] = mt[3] * m2[1] + mt[4] * m2[4] + mt[5] * m2[7];
        m1[5] = mt[3] * m2[2] + mt[4] * m2[5] + mt[5] * m2[8];
        m1[6] = mt[6] * m2[0] + mt[7] * m2[3] + mt[8] * m2[6];
        m1[7] = mt[6] * m2[1] + mt[7] * m2[4] + mt[8] * m2[7];
        m1[8] = mt[6] * m2[2] + mt[7] * m2[5] + mt[8] * m2[8];
        _releaseTempMatrix(index);
    };
    /**
     * Multiples the given 3x3 matrix m1 in-place by the 3x3 matrix m2 from the right
     * multiple times.
     * @param {Float32Array} m1
     * @param {Float32Array} m2
     * @param {Number} count The number of times to repeat the multiplication
     */
    mat.mul3multi = function (m1, m2, count) {
        var
                i,
                index = _getFreeTempMatrixIndex(),
                mt = _getTempMatrix(index);
        for (i = 0; i < count; i++) {
            mat.setMatrix3(mt, m1);
            m1[0] = mt[0] * m2[0] + mt[1] * m2[3] + mt[2] * m2[6];
            m1[1] = mt[0] * m2[1] + mt[1] * m2[4] + mt[2] * m2[7];
            m1[2] = mt[0] * m2[2] + mt[1] * m2[5] + mt[2] * m2[8];
            m1[3] = mt[3] * m2[0] + mt[4] * m2[3] + mt[5] * m2[6];
            m1[4] = mt[3] * m2[1] + mt[4] * m2[4] + mt[5] * m2[7];
            m1[5] = mt[3] * m2[2] + mt[4] * m2[5] + mt[5] * m2[8];
            m1[6] = mt[6] * m2[0] + mt[7] * m2[3] + mt[8] * m2[6];
            m1[7] = mt[6] * m2[1] + mt[7] * m2[4] + mt[8] * m2[7];
            m1[8] = mt[6] * m2[2] + mt[7] * m2[5] + mt[8] * m2[8];
        }
        _releaseTempMatrix(index);
    };
    /**
     * Multiples the given 4x4 matrix m1 in place by the 4x4 matrix m2 from the right.
     * @param {Float32Array} m1
     * @param {Float32Array} m2
     */
    mat.mul4 = function (m1, m2) {
        var
                index = _getFreeTempMatrixIndex(),
                m3 = _getTempMatrix(index);
        mat.setMatrix4(m3, m1);
        m1[0] = m3[0] * m2[0] + m3[1] * m2[4] + m3[2] * m2[8] + m3[3] * m2[12];
        m1[1] = m3[0] * m2[1] + m3[1] * m2[5] + m3[2] * m2[9] + m3[3] * m2[13];
        m1[2] = m3[0] * m2[2] + m3[1] * m2[6] + m3[2] * m2[10] + m3[3] * m2[14];
        m1[3] = m3[0] * m2[3] + m3[1] * m2[7] + m3[2] * m2[11] + m3[3] * m2[15];
        m1[4] = m3[4] * m2[0] + m3[5] * m2[4] + m3[6] * m2[8] + m3[7] * m2[12];
        m1[5] = m3[4] * m2[1] + m3[5] * m2[5] + m3[6] * m2[9] + m3[7] * m2[13];
        m1[6] = m3[4] * m2[2] + m3[5] * m2[6] + m3[6] * m2[10] + m3[7] * m2[14];
        m1[7] = m3[4] * m2[3] + m3[5] * m2[7] + m3[6] * m2[11] + m3[7] * m2[15];
        m1[8] = m3[8] * m2[0] + m3[9] * m2[4] + m3[10] * m2[8] + m3[11] * m2[12];
        m1[9] = m3[8] * m2[1] + m3[9] * m2[5] + m3[10] * m2[9] + m3[11] * m2[13];
        m1[10] = m3[8] * m2[2] + m3[9] * m2[6] + m3[10] * m2[10] + m3[11] * m2[14];
        m1[11] = m3[8] * m2[3] + m3[9] * m2[7] + m3[10] * m2[11] + m3[11] * m2[15];
        m1[12] = m3[12] * m2[0] + m3[13] * m2[4] + m3[14] * m2[8] + m3[15] * m2[12];
        m1[13] = m3[12] * m2[1] + m3[13] * m2[5] + m3[14] * m2[9] + m3[15] * m2[13];
        m1[14] = m3[12] * m2[2] + m3[13] * m2[6] + m3[14] * m2[10] + m3[15] * m2[14];
        m1[15] = m3[12] * m2[3] + m3[13] * m2[7] + m3[14] * m2[11] + m3[15] * m2[15];
        _releaseTempMatrix(index);
    };
    /**
     * Modifies the passed 4x4 matrix is place, multiplying it with the passed 3x3 matrix
     * padded to a 4x4 matrix (complemented as an identity matrix, with a 0,0,0,1 last row/column)
     * @param {Float32Array} m4 A 4x4 matrix
     * @param {Float32Array} m3 A 3x3 matrix
     */
    mat.mul43 = function (m4, m3) {
        var
                index = _getFreeTempMatrixIndex(),
                mt = _getTempMatrix(index);
        mat.setMatrix4(mt, m4);
        m4[0] = mt[0] * m3[0] + mt[1] * m3[3] + mt[2] * m3[6];
        m4[1] = mt[0] * m3[1] + mt[1] * m3[4] + mt[2] * m3[7];
        m4[2] = mt[0] * m3[2] + mt[1] * m3[5] + mt[2] * m3[8];
        m4[4] = mt[4] * m3[0] + mt[5] * m3[3] + mt[6] * m3[6];
        m4[5] = mt[4] * m3[1] + mt[5] * m3[4] + mt[6] * m3[7];
        m4[6] = mt[4] * m3[2] + mt[5] * m3[5] + mt[6] * m3[8];
        m4[8] = mt[8] * m3[0] + mt[9] * m3[3] + mt[10] * m3[6];
        m4[9] = mt[8] * m3[1] + mt[9] * m3[4] + mt[10] * m3[7];
        m4[10] = mt[8] * m3[2] + mt[9] * m3[5] + mt[10] * m3[8];
        m4[12] = mt[12] * m3[0] + mt[13] * m3[3] + mt[14] * m3[6];
        m4[13] = mt[12] * m3[1] + mt[13] * m3[4] + mt[14] * m3[7];
        m4[14] = mt[12] * m3[2] + mt[13] * m3[5] + mt[14] * m3[8];
        _releaseTempMatrix(index);
    };
    /**
     * Modifies the passed 4x4 rotation matrix is place, multiplying it with the passed 3x3 matrix
     * padded to a 4x4 matrix (complemented as an identity matrix, with a 0,0,0,1 last row/column)
     * @param {Float32Array} m4 A 4x4 rotation matrix
     * @param {Float32Array} m3 A 3x3 matrix
     */
    mat.mulRotation43 = function (m4, m3) {
        var
                index = _getFreeTempMatrixIndex(),
                mt = _getTempMatrix(index);
        mat.copyRotation4(mt, m4);
        m4[0] = mt[0] * m3[0] + mt[1] * m3[3] + mt[2] * m3[6];
        m4[1] = mt[0] * m3[1] + mt[1] * m3[4] + mt[2] * m3[7];
        m4[2] = mt[0] * m3[2] + mt[1] * m3[5] + mt[2] * m3[8];
        m4[4] = mt[4] * m3[0] + mt[5] * m3[3] + mt[6] * m3[6];
        m4[5] = mt[4] * m3[1] + mt[5] * m3[4] + mt[6] * m3[7];
        m4[6] = mt[4] * m3[2] + mt[5] * m3[5] + mt[6] * m3[8];
        m4[8] = mt[8] * m3[0] + mt[9] * m3[3] + mt[10] * m3[6];
        m4[9] = mt[8] * m3[1] + mt[9] * m3[4] + mt[10] * m3[7];
        m4[10] = mt[8] * m3[2] + mt[9] * m3[5] + mt[10] * m3[8];
        _releaseTempMatrix(index);
    };
    /**
     * Modifies the passed 4x4 rotation matrix is place, multiplying it with the passed 3x3 matrix
     * padded to a 4x4 matrix (complemented as an identity matrix, with a 0,0,0,1 last row/column)
     * multiple times.
     * @param {Float32Array} m4 A 4x4 rotation matrix
     * @param {Float32Array} m3 A 3x3 matrix
     * @param {Number} count The number of times to repeat the multiplication
     */
    mat.mulRotation43Multi = function (m4, m3, count) {
        var
                i,
                index = _getFreeTempMatrixIndex(),
                mt = _getTempMatrix(index);
        for (i = 0; i < count; i++) {
            mat.copyRotation4(mt, m4);
            m4[0] = mt[0] * m3[0] + mt[1] * m3[3] + mt[2] * m3[6];
            m4[1] = mt[0] * m3[1] + mt[1] * m3[4] + mt[2] * m3[7];
            m4[2] = mt[0] * m3[2] + mt[1] * m3[5] + mt[2] * m3[8];
            m4[4] = mt[4] * m3[0] + mt[5] * m3[3] + mt[6] * m3[6];
            m4[5] = mt[4] * m3[1] + mt[5] * m3[4] + mt[6] * m3[7];
            m4[6] = mt[4] * m3[2] + mt[5] * m3[5] + mt[6] * m3[8];
            m4[8] = mt[8] * m3[0] + mt[9] * m3[3] + mt[10] * m3[6];
            m4[9] = mt[8] * m3[1] + mt[9] * m3[4] + mt[10] * m3[7];
            m4[10] = mt[8] * m3[2] + mt[9] * m3[5] + mt[10] * m3[8];
        }
        _releaseTempMatrix(index);
    };
    /**
     * Multiples the given 4x4 rotation matrix m1 in place by the 4x4 rotation matrix m2 from the right.
     * @param {Float32Array} m1
     * @param {Float32Array} m2
     */
    mat.mulRotationRotation4 = function (m1, m2) {
        var
                index = _getFreeTempMatrixIndex(),
                m3 = _getTempMatrix(index);
        mat.copyRotation4(m3, m1);
        m1[0] = m3[0] * m2[0] + m3[1] * m2[4] + m3[2] * m2[8];
        m1[1] = m3[0] * m2[1] + m3[1] * m2[5] + m3[2] * m2[9];
        m1[2] = m3[0] * m2[2] + m3[1] * m2[6] + m3[2] * m2[10];
        m1[4] = m3[4] * m2[0] + m3[5] * m2[4] + m3[6] * m2[8];
        m1[5] = m3[4] * m2[1] + m3[5] * m2[5] + m3[6] * m2[9];
        m1[6] = m3[4] * m2[2] + m3[5] * m2[6] + m3[6] * m2[10];
        m1[8] = m3[8] * m2[0] + m3[9] * m2[4] + m3[10] * m2[8];
        m1[9] = m3[8] * m2[1] + m3[9] * m2[5] + m3[10] * m2[9];
        m1[10] = m3[8] * m2[2] + m3[9] * m2[6] + m3[10] * m2[10];
        _releaseTempMatrix(index);
    };
    /**
     * Sets a passed 4x4 matrix to be equal with the product of two other 4x4 matrices
     * @param {Float32Array} m The 4x4 matrix to modify.
     * @param {Float32Array} m1 The 4x4 matrix on the left of the multiplicaton.
     * @param {Float32Array} m2 The 4x4 matrix on the right of the multiplicaton.
     */
    mat.setProd4 = function (m, m1, m2) {
        m[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8] + m1[3] * m2[12];
        m[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9] + m1[3] * m2[13];
        m[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10] + m1[3] * m2[14];
        m[3] = m1[0] * m2[3] + m1[1] * m2[7] + m1[2] * m2[11] + m1[3] * m2[15];
        m[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8] + m1[7] * m2[12];
        m[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9] + m1[7] * m2[13];
        m[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10] + m1[7] * m2[14];
        m[7] = m1[4] * m2[3] + m1[5] * m2[7] + m1[6] * m2[11] + m1[7] * m2[15];
        m[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8] + m1[11] * m2[12];
        m[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9] + m1[11] * m2[13];
        m[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10] + m1[11] * m2[14];
        m[11] = m1[8] * m2[3] + m1[9] * m2[7] + m1[10] * m2[11] + m1[11] * m2[15];
        m[12] = m1[12] * m2[0] + m1[13] * m2[4] + m1[14] * m2[8] + m1[15] * m2[12];
        m[13] = m1[12] * m2[1] + m1[13] * m2[5] + m1[14] * m2[9] + m1[15] * m2[13];
        m[14] = m1[12] * m2[2] + m1[13] * m2[6] + m1[14] * m2[10] + m1[15] * m2[14];
        m[15] = m1[12] * m2[3] + m1[13] * m2[7] + m1[14] * m2[11] + m1[15] * m2[15];
    };
    /**
     * Sets a passed 4x4 matrix to be equal with the product of two other 4x4 matrices, assuming
     * that the 4th rows and columns are all (0, 0, 0, 1)
     * @param {Float32Array} m The 4x4 matrix to modify.
     * @param {Float32Array} m1 The 4x4 matrix on the left of the multiplicaton.
     * @param {Float32Array} m2 The 4x4 matrix on the right of the multiplicaton.
     */
    mat.setProd4NoProj = function (m, m1, m2) {
        m[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8];
        m[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9];
        m[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10];
        m[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8];
        m[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9];
        m[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10];
        m[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8];
        m[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9];
        m[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10];
        m[12] = m1[12] * m2[0] + m1[13] * m2[4] + m1[14] * m2[8] + m2[12];
        m[13] = m1[12] * m2[1] + m1[13] * m2[5] + m1[14] * m2[9] + m2[13];
        m[14] = m1[12] * m2[2] + m1[13] * m2[6] + m1[14] * m2[10] + m2[14];
    };
    /**
     * Modifies a 4x4 matrix in-place to be equal to the product of the upper left 3x3 submatrices of two 4x4 matrices padded to a 4x4 matrix.
     * @param {Float32Array} m The 4x4 matrix to modify
     * @param {Float32Array} m1 The 4x4 matrix on the left of the multiplicaton.
     * @param {Float32Array} m2 The 4x4 matrix on the right of the multiplicaton.
     */
    mat.setProd3x3SubOf4 = function (m, m1, m2) {
        m[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8];
        m[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9];
        m[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10];
        m[3] = 0;
        m[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8];
        m[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9];
        m[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10];
        m[7] = 0;
        m[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8];
        m[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9];
        m[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10];
        m[11] = 0;
        m[12] = 0;
        m[13] = 0;
        m[14] = 0;
        m[15] = 1;
    };
    /**
     * Updates the rotation component of 4x4 matrix m to be equal to the product of
     * 4x4 rotation matrix r1 and the inverse of 4x4 rotation matrix r2
     * @param {Float32Array} m A 4x4 matrix
     * @param {Float32Array} r1 A 4x4 matrix
     * @param {Float32Array} r2 A 4x4 matrix
     */
    mat.updateProdRotationRotationInverse4 = function (m, r1, r2) {
        m[0] = r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2];
        m[1] = r1[0] * r2[4] + r1[1] * r2[5] + r1[2] * r2[6];
        m[2] = r1[0] * r2[8] + r1[1] * r2[9] + r1[2] * r2[10];
        m[4] = r1[4] * r2[0] + r1[5] * r2[1] + r1[6] * r2[2];
        m[5] = r1[4] * r2[4] + r1[5] * r2[5] + r1[6] * r2[6];
        m[6] = r1[4] * r2[8] + r1[5] * r2[9] + r1[6] * r2[10];
        m[8] = r1[8] * r2[0] + r1[9] * r2[1] + r1[10] * r2[2];
        m[9] = r1[8] * r2[4] + r1[9] * r2[5] + r1[10] * r2[6];
        m[10] = r1[8] * r2[8] + r1[9] * r2[9] + r1[10] * r2[10];
    };
    /**
     * Modifies the 3x3 matrix m to be equal to the product of the rotation
     * components of 4x4 rotation matrix r1 and the inverse of 4x4 rotation matrix r2
     * @param {Float32Array} m A 3x3 matrix
     * @param {Float32Array} r1 A 4x4 matrix
     * @param {Float32Array} r2 A 4x4 matrix
     */
    mat.setProdRotationRotationInverse43 = function (m, r1, r2) {
        m[0] = r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2];
        m[1] = r1[0] * r2[4] + r1[1] * r2[5] + r1[2] * r2[6];
        m[2] = r1[0] * r2[8] + r1[1] * r2[9] + r1[2] * r2[10];
        m[3] = r1[4] * r2[0] + r1[5] * r2[1] + r1[6] * r2[2];
        m[4] = r1[4] * r2[4] + r1[5] * r2[5] + r1[6] * r2[6];
        m[5] = r1[4] * r2[8] + r1[5] * r2[9] + r1[6] * r2[10];
        m[6] = r1[8] * r2[0] + r1[9] * r2[1] + r1[10] * r2[2];
        m[7] = r1[8] * r2[4] + r1[9] * r2[5] + r1[10] * r2[6];
        m[8] = r1[8] * r2[8] + r1[9] * r2[9] + r1[10] * r2[10];
    };
    /**
     * Modifies a 4x4 scaling matrix in-place to be equal to the product of two 4x4 sacling matrices.
     * @param {Float32Array} m The 4x4 scaling matrix to modify
     * @param {Float32Array} m1 The 4x4 scaling matrix on the left of the multiplicaton.
     * @param {Float32Array} m2 The 4x4 scaling matrix on the right of the multiplicaton.
     */
    mat.setScalingToProdScalingScaling4 = function (m, m1, m2) {
        m[0] = m1[0] * m2[0];
        m[5] = m1[5] * m2[5];
        m[10] = m1[10] * m2[10];
    };
    /**
     * Performs an optimized multiplication of two matrices using the assumption that the left matrix is a translation matrix and the right
     * matrix if a rotation (or scaled rotation, but without projection or translation) matrix and sets a passed matrix to be equal to the
     * result.
     * @param {Float32Array} m The 4x4 matrix to set
     * @param {Float32Array} t A 4x4 translation matrix, without rotation, scaling or projection.
     * @param {Float32Array} r A 4x4 rotation or scaling and rotation matrix, without translation or projection.
     */
    mat.setProdTranslationRotation4 = function (m, t, r) {
        m[0] = r[0];
        m[1] = r[1];
        m[2] = r[2];
        m[3] = 0;
        m[4] = r[4];
        m[5] = r[5];
        m[6] = r[6];
        m[7] = 0;
        m[8] = r[8];
        m[9] = r[9];
        m[10] = r[10];
        m[11] = 0;
        m[12] = r[0] * t[12] + r[4] * t[13] + r[8] * t[14];
        m[13] = r[1] * t[12] + r[5] * t[13] + r[9] * t[14];
        m[14] = r[2] * t[12] + r[6] * t[13] + r[10] * t[14];
        m[15] = 1;
    };
    /**
     * Performs an optimized multiplication of two matrices using the assumption that the left matrix is a translation matrix and the right
     * matrix if a rotation (or scaled rotation, but without projection or translation) matrix and sets a passed matrix to be equal to the
     * product of the translation matrix and the inverse of the rotation matrix. Only updates the rotation and translation components of m.
     * @param {Float32Array} m The 4x4 matrix to set
     * @param {Float32Array} t A 4x4 translation matrix, without rotation, scaling or projection.
     * @param {Float32Array} r A 4x4 rotation or scaling and rotation matrix, without translation or projection.
     */
    mat.updateProdTranslationRotationInverse4 = function (m, t, r) {
        m[0] = r[0];
        m[1] = r[4];
        m[2] = r[8];
        m[4] = r[1];
        m[5] = r[5];
        m[6] = r[9];
        m[8] = r[2];
        m[9] = r[6];
        m[10] = r[10];
        m[12] = r[0] * t[12] + r[1] * t[13] + r[2] * t[14];
        m[13] = r[4] * t[12] + r[5] * t[13] + r[6] * t[14];
        m[14] = r[8] * t[12] + r[9] * t[13] + r[10] * t[14];
    };
    /**
     * Multiplies a 4x4 scaling matrix with a 4x4 rotation matrix.
     * @param {Float32Array} m A 4x4 matrix to save the result of the multiplication to.
     * @param {Float32Array} sm The 4x4 scaling matrix on the left of the multiplicaton.
     * @param {Float32Array} rm The 4x4 rotation matrix on the right of the multiplicaton.
     */
    mat.setProdScalingRotation = function (m, sm, rm) {
        m[0] = sm[0] * rm[0];
        m[1] = sm[0] * rm[1];
        m[2] = sm[0] * rm[2];
        m[3] = 0;
        m[4] = sm[5] * rm[4];
        m[5] = sm[5] * rm[5];
        m[6] = sm[5] * rm[6];
        m[7] = 0;
        m[8] = sm[10] * rm[8];
        m[9] = sm[10] * rm[9];
        m[10] = sm[10] * rm[10];
        m[11] = 0;
        m[12] = 0;
        m[13] = 0;
        m[14] = 0;
        m[15] = 1;
    };
    /**
     * Sets (updates) a model matrix based on the passed translation, rotation 
     * and scaling matrices.
     * @param {Float32Array} m The 4x4 model matrix to update
     * @param {Float32Array} t A 4x4 translation matrix
     * @param {Float32Array} r A 4x4 rotation matrix
     * @param {Float32Array} s A 4x4 scaling matrix
     */
    mat.setModelMatrix = function (m, t, r, s) {
        m[0] = s[0] * r[0];
        m[1] = s[0] * r[1];
        m[2] = s[0] * r[2];
        m[4] = s[5] * r[4];
        m[5] = s[5] * r[5];
        m[6] = s[5] * r[6];
        m[8] = s[10] * r[8];
        m[9] = s[10] * r[9];
        m[10] = s[10] * r[10];
        m[12] = t[12];
        m[13] = t[13];
        m[14] = t[14];
    };
    /**
     * Updates an inverse model matrix based on the passed translation and rotation
     * matrices and the inverse scaling factor isf (assuming uniform scaling)
     * @param {Float32Array} m The 4x4 matrix to update
     * @param {Float32Array} t A 4x4 translation matrix
     * @param {Float32Array} r A 4x4 rotation matrix
     * @param {Number} isf The reciprocal of the uniform scaling factor
     */
    mat.updateModelMatrixInverse = function (m, t, r, isf) {
        m[0] = r[0] * isf;
        m[1] = r[4] * isf;
        m[2] = r[8] * isf;
        m[4] = r[1] * isf;
        m[5] = r[5] * isf;
        m[6] = r[9] * isf;
        m[8] = r[2] * isf;
        m[9] = r[6] * isf;
        m[10] = r[10] * isf;
        m[12] = -m[0] * t[12] - m[4] * t[13] - m[8] * t[14];
        m[13] = -m[1] * t[12] - m[5] * t[13] - m[9] * t[14];
        m[14] = -m[2] * t[12] - m[6] * t[13] - m[10] * t[14];
    };
    /**
     * Modifies a 4x4 transformation matrix, setting it to be equal to the result of translating m1 by the translation vector v
     * @param {Float32Array} m The 4x4 transformation matrix to modify
     * @param {Float32Array} m1 A 4x4 transformation matrix.
     * @param {Float32Array} v A 3D vector.
     */
    mat.setTranslatedByVector = function (m, m1, v) {
        m[0] = m1[0];
        m[1] = m1[1];
        m[2] = m1[2];
        m[3] = m1[3];
        m[4] = m1[4];
        m[5] = m1[5];
        m[6] = m1[6];
        m[7] = m1[7];
        m[8] = m1[8];
        m[9] = m1[9];
        m[10] = m1[10];
        m[11] = m1[11];
        m[12] = m1[12] + v[0];
        m[13] = m1[13] + v[1];
        m[14] = m1[14] + v[2];
        m[15] = m1[15];
    };
    /**
     * Modifies a 4x4 transformation matrix, setting it to be equal to the result of translating m1 by the translation described by m2.
     * @param {Float32Array} m The 4x4 transformation matrix to modify
     * @param {Float32Array} m1 A 4x4 transformation matrix.
     * @param {Float32Array} m2 A 4x4 transformation matrix. Only the translation described in this matrix will be taken into account.
     */
    mat.setTranslatedByM4 = function (m, m1, m2) {
        m[0] = m1[0];
        m[1] = m1[1];
        m[2] = m1[2];
        m[3] = m1[3];
        m[4] = m1[4];
        m[5] = m1[5];
        m[6] = m1[6];
        m[7] = m1[7];
        m[8] = m1[8];
        m[9] = m1[9];
        m[10] = m1[10];
        m[11] = m1[11];
        m[12] = m1[12] + m2[12];
        m[13] = m1[13] + m2[13];
        m[14] = m1[14] + m2[14];
        m[15] = m1[15];
    };
    /**
     * Modifies a 4x4 transformation matrix, setting it to describe perspective projection.
     * @param {Float32Array} m The matrix to modify
     * @param {Number} right
     * @param {Number} top
     * @param {Number} near
     * @param {Number} far
     */
    mat.setPerspective4 = function (m, right, top, near, far) {
        m[0] = near / right;
        m[1] = 0.0;
        m[2] = 0.0;
        m[3] = 0.0;
        m[4] = 0.0;
        m[5] = near / top;
        m[6] = 0.0;
        m[7] = 0.0;
        m[8] = 0.0;
        m[9] = 0.0;
        m[10] = (near + far) / (near - far);
        m[11] = -1.0;
        m[12] = 0.0;
        m[13] = 0.0;
        m[14] = 2 * near * far / (near - far);
        m[15] = 0.0;
    };
    /**
     * Modifies a 4x4 transformation matrix, setting it to describe an orthographic projection.
     * @param {Float32Array} m The matrix to modify
     * @param {Number} right
     * @param {Number} top
     * @param {Number} near
     * @param {Number} far
     */
    mat.setOrthographic4 = function (m, right, top, near, far) {
        m[0] = 1 / right;
        m[1] = 0.0;
        m[2] = 0.0;
        m[3] = 0.0;
        m[4] = 0.0;
        m[5] = 1 / top;
        m[6] = 0.0;
        m[7] = 0.0;
        m[8] = 0.0;
        m[9] = 0.0;
        m[10] = -2.0 / (far - near);
        m[11] = 0.0;
        m[12] = 0.0;
        m[13] = 0.0;
        m[14] = -(near + far) / 2.0;
        m[15] = 1.0;
    };
    /**
     * Modifies the passed matrix m in-place to ensure its orthogonality.
     * @param {Float32Array} m
     */
    mat.correctOrthogonal4 = function (m) {
        var
                vx = vec.normalize3([m[0], m[1], m[2]]),
                vy = vec.normalize3([m[4], m[5], m[6]]),
                vz = vec.cross3Aux(vx, vy);
        vec.setCross3(vy, vz, vx);
        m[0] = vx[0];
        m[1] = vx[1];
        m[2] = vx[2];
        m[3] = 0.0;
        m[4] = vy[0];
        m[5] = vy[1];
        m[6] = vy[2];
        m[7] = 0.0;
        m[8] = vz[0];
        m[9] = vz[1];
        m[10] = vz[2];
        m[11] = 0.0;
    };
    /**
     * Modifies the passed 4x4 translation matrix m to a "straigthened" version, 
     * which means that the translation coordinates which are at least epsilon-close 
     * to -1, 0 or 1 will be changed to -1, 0 or 1 respectively.
     * @param {Float32Array} m The input 4x4 translation matrix.
     * @param {Number} epsilon The difference threshold within the matrix components
     * will be corrected.
     */
    mat.straightenTranslation = function (m, epsilon) {
        m[12] = (Math.abs(m[12]) < epsilon) ? 0.0 : ((Math.abs(1 - m[12]) < epsilon) ? 1.0 : ((Math.abs(-1 - m[12]) < epsilon) ? -1.0 : m[12]));
        m[13] = (Math.abs(m[13]) < epsilon) ? 0.0 : ((Math.abs(1 - m[13]) < epsilon) ? 1.0 : ((Math.abs(-1 - m[13]) < epsilon) ? -1.0 : m[13]));
        m[14] = (Math.abs(m[14]) < epsilon) ? 0.0 : ((Math.abs(1 - m[14]) < epsilon) ? 1.0 : ((Math.abs(-1 - m[14]) < epsilon) ? -1.0 : m[14]));
    };
    /**
     * Modifies the passed 4x4 rotation matrix m to a "straigthened" version, 
     * which means that the rotation coordinates which are at least epsilon-close 
     * to -1, 0 or 1 will be changed to -1, 0 or 1 respectively.
     * @param {Float32Array} m The input 4x4 translation matrix.
     * @param {Number} epsilon The difference threshold within the matrix components
     * will be corrected.
     */
    mat.straightenRotation4 = function (m, epsilon) {
        var i;
        for (i = 0; i < 11; i++) {
            m[i] = (Math.abs(m[i]) < epsilon) ?
                    0.0 :
                    ((Math.abs(1 - m[i]) < epsilon) ?
                            1.0 :
                            ((Math.abs(-1 - m[i]) < epsilon) ?
                                    -1.0 : m[i]));
        }
    };
    // ----------------------------------------------------------------------
    // Initialization
    (function () {
        var i;
        for (i = 0; i < AUX_MATRIX_COUNT; i++) {
            _auxMatrices.push(mat.identity4());
        }
        for (i = 0; i < AUX_MATRIX_COUNT; i++) {
            _auxMatrices3.push(mat.identity3());
        }
    }());
    // ----------------------------------------------------------------------
    // Returning the public interface
    return mat;
});