module.exports = {
    entry: './src/globe.js', // or the correct entry point file
    output: {
      path: __dirname + '/dist',
      filename: 'bundle.js',
      library: {
        name: 'Globe',
        type: 'umd',
        export: 'Globe',
      },
      globalObject: 'this',
    },
    externals: {
      three: {
        commonjs: 'three',
        commonjs2: 'three',
        amd: 'three',
        root: 'THREE',
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.js'],
    },
  };
  